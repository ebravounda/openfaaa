import { useEffect, useState } from "react";
import api from "@/lib/api";

export function BrandLogo({ fallback, className, alt = "Logo" }) {
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    let ok = true;
    api.get("/branding").then((r) => { if (ok) setLogo(r.data?.logo || ""); }).catch(() => {});
    return () => { ok = false; };
  }, []);
  return <img src={logo || fallback} alt={alt} className={className} />;
}
