require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 4000;

// Conexión a PostgreSQL usando DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

// Función para crear token
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

// Middleware para proteger rutas
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "No se proporcionó token" });
  }

  const token = authHeader.split(" ")[1]; // "Bearer token"

  if (!token) {
    return res.status(401).json({ error: "Token inválido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token no válido o expirado" });
  }
}

app.get("/api/solicitudes/aceptadas", authMiddleware, async (req, res) => {
  res.json({
    solicitudes: [
      {
        id: 1,
        titulo: "Clases de Matemáticas",
        descripcion: "Sesión de 1 hora sobre álgebra.",
        fecha: "2025-11-14",
        usuario: "Juan Pérez",
      },
      {
        id: 2,
        titulo: "Corte de cabello",
        descripcion: "Servicio realizado en la barbería del campus.",
        fecha: "2025-11-12",
        usuario: "Ana Gómez",
      },
    ],
  });
});

// Ruta de prueba pública
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando con tokens 🚀" });
});

// 🔐 REGISTRO (devuelve token)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [nombre, email, hashed]
    );

    const user = result.rows[0];
    const token = crearToken(user);

    res.status(201).json({
      message: "Usuario registrado correctamente ✔️",
      user,
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

// 🔑 LOGIN (devuelve token)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Correo o contraseña incorrectos" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(400).json({ error: "Correo o contraseña incorrectos" });
    }

    const token = crearToken(user);

    res.json({
      message: "Login exitoso ✔️",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// 🔒 Ruta protegida de ejemplo
app.get("/api/profile", authMiddleware, async (req, res) => {
  // req.user viene del token (id, email)
  res.json({
    message: "Perfil del usuario autenticado",
    user: req.user,
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
