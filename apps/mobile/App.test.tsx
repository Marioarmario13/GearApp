import { render, screen } from "@testing-library/react-native";
import App from "./App";

test("tela inicial exibe o nome do produto", async () => {
  await render(<App />);
  expect(screen.getByRole("header")).toHaveTextContent("Gearhead");
});
