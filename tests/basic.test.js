test("index.js carga sin errores", () => {
  expect(() => require("../index")).not.toThrow();
});
