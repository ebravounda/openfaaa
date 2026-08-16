import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const [form, setForm] = useState({
    name: "", nif: "", address: "", email: "", phone: "", tax_type: "autonomo",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/company").then((r) => {
      if (r.data && r.data.name) setForm({ ...form, ...r.data });
    }).finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Introduce el nombre de tu empresa o actividad");
    setSaving(true);
    try {
      await api.put("/company", form);
      toast.success("Datos guardados");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Layout>
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>
      </Layout>
    );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter text-[#111111]">Configuración</h1>
        <p className="text-sm text-[#666666] mt-1">Los datos de tu empresa aparecerán en tus facturas</p>
      </div>

      <Card className="p-6 sm:p-8 bg-white border border-[#E5E5E5] rounded-md shadow-none max-w-2xl">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre / Razón social</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="company-name" />
            </div>
            <div className="space-y-2">
              <Label>NIF / CIF</Label>
              <Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} placeholder="B12345678 / 12345678Z" data-testid="company-nif" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dirección fiscal</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="company-address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="company-email" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="company-phone" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo de actividad</Label>
            <Select value={form.tax_type} onValueChange={(v) => setForm({ ...form, tax_type: v })}>
              <SelectTrigger data-testid="company-tax-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="autonomo">Autónomo</SelectItem>
                <SelectItem value="empresa">Empresa / Sociedad</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving} className="bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-md" data-testid="save-company">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar datos
          </Button>
        </div>
      </Card>
    </Layout>
  );
}
