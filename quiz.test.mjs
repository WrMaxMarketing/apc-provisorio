// Rode com: node quiz.test.mjs
import assert from "node:assert";
import { telLocal } from "./quiz.js";

for (const [entrada, esperado] of [
  ["+55 86 99999-0000", "86999990000"],
  ["5586999990000", "86999990000"],
  ["(86) 99999-0000", "86999990000"],
  ["086999990000", "86999990000"],
  ["+55 (86) 3222-1111", "8632221111"],
]) assert.equal(telLocal(entrada), esperado, entrada);
console.log("ok");
