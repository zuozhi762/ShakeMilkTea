import type { Metadata } from "next";
import { MilkTeaGame } from "./milk-tea-game";

export const metadata: Metadata = {
  title: "摇摇奶茶大合成",
  description: "在会晃动、会被吸管吸走的奶茶杯里，从西米一路合成到柿子。",
};

export default function Home() {
  return <MilkTeaGame />;
}
