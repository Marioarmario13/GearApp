import { useLocalSearchParams } from "expo-router";
import { OfferScreen } from "@/screens/OffersScreens";

export default function OfferRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OfferScreen id={id} />;
}
