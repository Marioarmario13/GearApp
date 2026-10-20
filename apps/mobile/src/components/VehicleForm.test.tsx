import { fireEvent, render, screen } from "@testing-library/react-native";
import { VehicleForm } from "./VehicleForm";

test("valida campos obrigatórios e não envia", async () => {
  const onSubmit = jest.fn();
  await render(<VehicleForm submitLabel="Salvar" onSubmit={onSubmit} />);
  await fireEvent.press(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByText("Informe a marca")).toBeOnTheScreen();
  expect(screen.getByText("Informe o ano")).toBeOnTheScreen();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("envia dados normalizados (ano numérico, placa em maiúsculas, visibilidade)", async () => {
  const onSubmit = jest.fn().mockResolvedValue("Salvo!");
  await render(<VehicleForm submitLabel="Salvar" onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText("Marca"), "Chevrolet");
  await fireEvent.changeText(screen.getByLabelText("Modelo"), "Opala");
  await fireEvent.changeText(screen.getByLabelText("Ano"), "1978");
  await fireEvent.changeText(screen.getByLabelText("Placa (opcional, só você vê)"), "opa-1978");
  await fireEvent.press(screen.getByRole("radio", { name: /Público/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByText("Salvo!")).toBeOnTheScreen();
  expect(onSubmit).toHaveBeenCalledWith({
    make: "Chevrolet",
    model: "Opala",
    year: 1978,
    nickname: null,
    plate: "OPA1978",
    visibility: "public",
  });
});

test("mostra a mensagem de erro lançada pelo onSubmit", async () => {
  const onSubmit = jest
    .fn()
    .mockRejectedValue(new Error("Limite de 20 veículos por usuário atingido."));
  await render(<VehicleForm submitLabel="Salvar" onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText("Marca"), "Fiat");
  await fireEvent.changeText(screen.getByLabelText("Modelo"), "Uno");
  await fireEvent.changeText(screen.getByLabelText("Ano"), "1995");
  await fireEvent.press(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByText("Limite de 20 veículos por usuário atingido.")).toBeOnTheScreen();
});
