# Mapas e geolocalização — comparação e decisão

> Etapa 5 (Radar). Pesquisa feita em **2026-10-20** em páginas oficiais e fontes secundárias (indicadas). Preços e limites mudam: **reconfirmar nos sites oficiais antes de publicar ou ampliar o uso.** Nada aqui garante gratuidade permanente.

## Requisitos

- Custo zero no protótipo, **sem cartão de crédito nem cobrança automática** (regra do projeto).
- Funcionar no site (Next.js) e no app (Expo), inclusive no **Expo Go** (sem build nativo).
- Uso comercial permitido (a plataforma terá parceiros e ofertas).
- Trocar de provedor sem reescrever código.

## Mapas base (tiles)

| Opção                                 | Custo / limites                                                                                                                                | Uso comercial                    | Cartão/conta                           | Expo Go                                       | Veredito                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| **OpenFreeMap** (vector, OSM)         | Instância pública sem limite de visualizações ou requisições; sem SLA; mantida por doações. Projeto MIT, auto-hospedável (downloads semanais). | Permitido                        | Nenhum (sem chave)                     | Sim (via MapLibre GL JS em WebView)           | **Escolhido** (com plano de saída)               |
| MapTiler Cloud — plano Free           | 5 mil sessões e 100 mil requisições/mês; ao exceder, o serviço **pausa até o mês seguinte**.                                                   | **Não** (só não comercial e P&D) | Conta e chave                          | Sim (WebView) / SDK nativo exige build        | Rejeitado: proíbe uso comercial                  |
| Mapbox                                | Fontes secundárias: 50 mil carregamentos web/mês e 25 mil MAU mobile grátis, depois cobrança por uso.                                          | Sim                              | Conta e chave; cartão: fontes divergem | SDK nativo exige build                        | Rejeitado: cobrança automática após a franquia   |
| Google Maps Platform                  | SDK Android/iOS: uso mobile ilimitado; mapas web (Dynamic Maps) cobrados após franquia mensal.                                                 | Sim                              | **Exige conta de faturamento**         | `react-native-maps` (chave própria em builds) | Rejeitado: exige faturamento ativo               |
| tile.openstreetmap.org (raster)       | Servidores por doação; **uso intenso proibido** sem autorização prévia; distribuir app que usa esses tiles é o exemplo de uso proibido.        | Restrito                         | Nenhum                                 | Sim                                           | Rejeitado: viola a política de uso               |
| Auto-hospedar (Protomaps/OpenFreeMap) | Custo de servidor/armazenamento; trabalho operacional.                                                                                         | Sim                              | Depende da hospedagem                  | Sim                                           | **Plano de saída** se a instância pública falhar |

## Renderização

| Plataforma | Escolha                                             | Motivo                                                                                                                           |
| ---------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Web        | **MapLibre GL JS** (open source, BSD-3)             | Renderiza vector tiles de qualquer provedor por URL de estilo; sem chave.                                                        |
| Mobile     | **MapLibre GL JS dentro de `react-native-webview`** | `react-native-webview` está no Expo Go; mesmo estilo e mesmo comportamento da web.                                               |
| Futuro     | `@maplibre/maplibre-react-native` (nativo)          | Melhor desempenho, mas **não roda no Expo Go** (exige development build). Migrar quando o projeto passar a usar builds próprios. |

## Geocodificação (endereço → coordenada)

| Opção                         | Situação                                                                                                                     | Decisão                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Nominatim (instância pública) | Máx. 1 req/s, User-Agent identificado, cache obrigatório; **proíbe autocomplete** e consultas sistemáticas; atribuição ODbL. | **Não usado no MVP.** Reavaliar com proxy + cache. |
| Mapbox/Google geocoding       | Exigem conta (e faturamento no Google).                                                                                      | Rejeitado.                                         |
| **Marcação manual no mapa**   | O dono do estabelecimento clica no mapa para posicionar o pin. Sem terceiros, sem custo, sem enviar endereço a ninguém.      | **Escolhido.**                                     |

## Decisão

1. **Tiles:** OpenFreeMap, estilo `https://tiles.openfreemap.org/styles/liberty`, configurável por variável de ambiente (`NEXT_PUBLIC_MAP_STYLE_URL` / `EXPO_PUBLIC_MAP_STYLE_URL`). Trocar de provedor = trocar a URL.
2. **Renderização:** MapLibre GL JS no site; o mesmo dentro de WebView no app.
3. **Atribuição obrigatória:** “OpenFreeMap © OpenMapTiles · Data from OpenStreetMap” — o MapLibre exibe pelo controle de atribuição; **nunca removê-lo**.
4. **Localização do parceiro:** pin manual no mapa (sem geocodificação externa).
5. **Localização do usuário:** opcional, pedida só quando ele toca em “usar minha localização”; usada apenas para a consulta, **arredondada para ~1 km** antes de sair do aparelho e **nunca armazenada**. Sem ela, o radar funciona por cidade/UF ou pelo centro do mapa.
6. **Buscas:** PostGIS no Supabase (`geography(Point, 4326)`, índice GiST, `ST_DWithin`), raio máximo e resultados limitados no servidor.

### Riscos e plano de saída

- A instância pública da OpenFreeMap **não tem SLA** e depende de doações. Se ficar indisponível ou mudar os termos: (a) apontar a URL de estilo para outro provedor compatível com MapLibre, ou (b) auto-hospedar (OpenFreeMap/Protomaps). O código não muda.
- WebView no app tem desempenho inferior ao SDK nativo; aceitável para o MVP.
- Reconfirmar termos (OpenFreeMap `/tos`) e limites antes do piloto (Etapa 9).

## Fontes

- OpenFreeMap: <https://openfreemap.org/> e <https://openfreemap.org/quick_start/>
- MapTiler Cloud: <https://www.maptiler.com/cloud/pricing/> e <https://www.maptiler.com/terms/cloud/>
- Google Maps SDK (uso e faturamento): <https://developers.google.com/maps/documentation/android-sdk/usage-and-billing>
- Mapbox (secundárias): <https://www.woosmap.com/blog/mapbox-pricing>, <https://agentdeals.dev/vendor/mapbox>
- Política de tiles OSM: <https://operations.osmfoundation.org/policies/tiles/>
- Política do Nominatim: <https://operations.osmfoundation.org/policies/nominatim/>
- MapLibre React Native no Expo: <https://maplibre.org/maplibre-react-native/docs/setup/expo>
- `react-native-webview` no Expo SDK 58: <https://docs.expo.dev/versions/v58.0.0/sdk/webview/>
