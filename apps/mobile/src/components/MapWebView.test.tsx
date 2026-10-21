import { act, render, screen } from "@testing-library/react-native";
import { MapWebView, type MapState } from "./MapWebView";

const injected: string[] = [];
jest.mock("react-native-webview", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const WebView = React.forwardRef(function WebViewMock(props: object, ref: unknown) {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (js: string) => injected.push(js),
    }));
    return <View testID="webview" {...props} />;
  });
  return { WebView, default: WebView };
});

const state: MapState = {
  center: { latitude: -25.43, longitude: -49.28 },
  zoom: 8,
  markers: [
    { id: "a", latitude: -25.4284, longitude: -49.2733 },
    { id: "b", latitude: -25.4374, longitude: -49.2733 },
    { id: "sp", latitude: -23.5505, longitude: -46.6333 },
  ],
};

async function message(data: object) {
  const webview = screen.getByTestId("webview");
  await act(async () => webview.props.onMessage({ nativeEvent: { data: JSON.stringify(data) } }));
}
const lastMarkers = () =>
  JSON.parse(
    injected
      .filter((js) => js.startsWith("window.__markers("))
      .at(-1)!
      .replace(/^window\.__markers\(/, "")
      .replace(/\); true;$/, ""),
  ) as { id: string; count?: number }[];

beforeEach(() => {
  injected.length = 0;
});

test("agrupa marcadores próximos, aproxima ao tocar no grupo e repassa toques em pontos", async () => {
  const onMarkerPress = jest.fn();
  await render(
    <MapWebView state={state} onMarkerPress={onMarkerPress} accessibilityLabel="Mapa" />,
  );
  await message({ type: "ready" });

  // A câmera vai sem marcadores; os marcadores vão agrupados.
  expect(injected.find((js) => js.startsWith("window.__update("))).not.toContain('"markers"');
  expect(lastMarkers()).toEqual([
    expect.objectContaining({ id: "cluster:a", count: 2 }),
    expect.objectContaining({ id: "sp" }),
  ]);

  await message({ type: "marker", id: "cluster:a" });
  expect(injected.at(-1)).toMatch(/^window\.__zoomTo\(/);
  expect(onMarkerPress).not.toHaveBeenCalled();

  // Com zoom alto o grupo se desfaz.
  await message({ type: "moveend", latitude: -25.43, longitude: -49.27, zoom: 15 });
  expect(lastMarkers().map((m) => m.id)).toEqual(["a", "b", "sp"]);
  await message({ type: "marker", id: "b" });
  expect(onMarkerPress).toHaveBeenCalledWith("b");
});
