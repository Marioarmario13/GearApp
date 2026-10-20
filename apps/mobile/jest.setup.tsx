// Módulos nativos sem implementação no Jest.
jest.mock("react-native-webview", () => {
  const { View } = jest.requireActual("react-native");
  const WebView = (props: object) => <View testID="webview" {...props} />;
  return { WebView, default: WebView };
});
