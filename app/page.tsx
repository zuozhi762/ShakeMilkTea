import type { Metadata } from "next";
import { MilkTeaGame } from "./milk-tea-game";

export const metadata: Metadata = {
  title: "这杯有点太刺激了",
  description: "在温暖手帐风奶茶杯里合成小料，躲开刺激吸管。",
};

export default function Home() {
  return <MilkTeaGame />;
}
