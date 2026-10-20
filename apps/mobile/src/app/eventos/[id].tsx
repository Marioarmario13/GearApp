import { useLocalSearchParams } from "expo-router";
import { EventScreen } from "@/screens/EventsScreens";

export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventScreen id={id} />;
}
