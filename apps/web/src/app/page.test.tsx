import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("página inicial exibe o nome do produto e os módulos", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "Gearhead" })).toBeDefined();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
});
