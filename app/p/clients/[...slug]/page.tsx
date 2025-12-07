import { redirect } from "next/navigation";

type LegacyParams = {
  params: { slug?: string[] };
};

export default function LegacyClientsCatchAll({ params }: LegacyParams) {
  const suffix = Array.isArray(params.slug) && params.slug.length ? `/${params.slug.join("/")}` : "";
  redirect(`/clients${suffix}`);
}
