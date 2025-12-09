test("index.js carga sin errores de sintaxis", () => {
  expect(() => require("../index.js")).not.toThrow();
});
