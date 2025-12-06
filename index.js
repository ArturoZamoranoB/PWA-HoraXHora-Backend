require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db.js");

const app = express();
const PORT = process.env.PORT || 4000;


app.use(cors());
app.use(express.json());

function crearToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" } // 1 día
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No se proporcionó token" });

  const token = authHeader.split(" ")[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: "Token inválido" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token no válido o expirado" });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando con tokens 🚀" });
});


app.post("/api/auth/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: "Faltan datos" });

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [nombre, email, hashed]
    );

    const user = result.rows[0];
    const token = crearToken(user);

    res.status(201).json({ message: "Usuario registrado correctamente", user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) return res.status(400).json({ error: "Correo o contraseña incorrectos" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: "Correo o contraseña incorrectos" });

    const token = crearToken(user);
    res.json({ message: "Login exitoso", user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});



// Perfil (ejemplo)
app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    // opcional: recuperar más datos del user desde la BD si quieres
    const result = await pool.query("SELECT id, name, email, created_at FROM users WHERE id = $1", [req.user.id]);
    const user = result.rows[0] || req.user;
    res.json({ message: "Perfil del usuario autenticado", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});


app.put("/api/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Faltan datos" });

    const updated = await pool.query(
      `UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, created_at`,
      [name, email, userId]
    );
    res.json({ message: "OK", user: updated.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
});


app.get("/api/solicitudes/pendientes", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, titulo, descripcion, alumno, fecha::text
       FROM solicitudes
       WHERE estado = 'PENDIENTE'
       ORDER BY fecha ASC`
    );
    res.json({ solicitudes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener solicitudes pendientes" });
  }
});


app.post("/api/solicitudes/:id/aceptar", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE solicitudes
       SET estado = 'ACEPTADA',
           aceptada_por = $1,
           aceptada_en = NOW()
       WHERE id = $2
         AND estado = 'PENDIENTE'
       RETURNING id, titulo, descripcion, alumno, fecha::text, estado`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "La solicitud ya fue aceptada o no existe" });
    }

    res.json({ message: "Solicitud aceptada correctamente", solicitud: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al aceptar la solicitud" });
  }
});


app.get("/api/solicitudes/aceptadas", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id, titulo, descripcion, alumno AS usuario, fecha::text
       FROM solicitudes
       WHERE estado = 'ACEPTADA' AND aceptada_por = $1
       ORDER BY aceptada_en DESC`,
      [userId]
    );
    res.json({ solicitudes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener solicitudes aceptadas" });
  }
});


app.post("/api/solicitudes", authMiddleware, async (req, res) => {
  try {
    const { titulo, descripcion, alumno, fecha } = req.body;

    if (!titulo || !alumno) {
      return res.status(400).json({
        ok: false,
        error: "Título y alumno son obligatorios"
      });
    }

    const result = await pool.query(
      `INSERT INTO solicitudes (titulo, descripcion, alumno, fecha, estado)
       VALUES ($1, $2, $3, $4, 'PENDIENTE')
       RETURNING id, titulo, descripcion, alumno, fecha, estado`,
      [titulo, descripcion || "", alumno, fecha]
    );

    res.status(201).json({
      ok: true,
      solicitud: result.rows[0]
    });

  } catch (err) {
    console.error("❌ Error al crear solicitud:", err);
    res.status(500).json({
      ok: false,
      error: "Error interno al crear solicitud"
    });
  }
});



app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
