import { useAuth } from "@/context/AuthContext";
import Pricing from "@/pages/Pricing";
import PreciosPublic from "@/pages/PreciosPublic";

// /precios público e indexable: anónimo → landing de precios; logueado → panel de planes/upgrade.
export default function PreciosRoute() {
  const { user } = useAuth();
  return user ? <Pricing /> : <PreciosPublic />;
}
