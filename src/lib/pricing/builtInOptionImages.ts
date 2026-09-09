import midterfalsetIcon from "@/assets/iconsprisberegner/midterfalset.png";
import portfalsetIcon from "@/assets/iconsprisberegner/portfalset.png";
import rullefalsetIcon from "@/assets/iconsprisberegner/rullefalset.png";
import zigzagfalsetIcon from "@/assets/iconsprisberegner/zigzagfalset.png";

export const getBuiltInOptionImage = (valueName: string) => {
  const normalized = valueName.toLocaleLowerCase("da-DK");
  if (normalized.includes("rullefals")) return rullefalsetIcon;
  if (normalized.includes("zigzag") || normalized.includes("zickzack")) return zigzagfalsetIcon;
  if (normalized.includes("midterfals")) return midterfalsetIcon;
  if (normalized.includes("portfals")) return portfalsetIcon;
  return undefined;
};
