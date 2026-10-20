import { useLocalSearchParams } from "expo-router";
import { VehicleScreen } from "@/screens/VehicleScreen";

export default function VehicleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VehicleScreen id={id} />;
}
