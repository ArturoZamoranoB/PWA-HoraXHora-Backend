test("server carga sin errores", () => {
  expect(() => require("../server")).not.toThrow();
});
