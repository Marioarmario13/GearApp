import { useLocalSearchParams } from "expo-router";
import { PartnerScreen } from "@/screens/PartnerScreen";

export default function PartnerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PartnerScreen id={id} />;
}
