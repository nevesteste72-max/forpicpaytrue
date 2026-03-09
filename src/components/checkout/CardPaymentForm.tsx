import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CardFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface CardPaymentFormProps {
  data: CardFormData;
  onChange: (data: CardFormData) => void;
  errors?: Partial<Record<keyof CardFormData, string>>;
}

export function CardPaymentForm({ data, onChange, errors }: CardPaymentFormProps) {
  const handleChange = (field: keyof CardFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, [field]: e.target.value });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name" className="text-sm font-medium">
            Nome
          </Label>
          <Input
            id="first_name"
            value={data.first_name}
            onChange={handleChange("first_name")}
            placeholder="João"
            className="h-12 rounded-xl border-2"
          />
          {errors?.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name" className="text-sm font-medium">
            Apelido
          </Label>
          <Input
            id="last_name"
            value={data.last_name}
            onChange={handleChange("last_name")}
            placeholder="Silva"
            className="h-12 rounded-xl border-2"
          />
          {errors?.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={data.email}
          onChange={handleChange("email")}
          placeholder="joao@email.com"
          className="h-12 rounded-xl border-2"
        />
        {errors?.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="card_phone" className="text-sm font-medium">
          Telefone (opcional)
        </Label>
        <Input
          id="card_phone"
          type="tel"
          value={data.phone}
          onChange={handleChange("phone")}
          placeholder="+258 84 XXX XXXX"
          className="h-12 rounded-xl border-2"
        />
      </div>
    </div>
  );
}
