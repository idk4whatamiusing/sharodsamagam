import fs from "fs";
import path from "path";
import PandalDirectory from "./PandalDirectory";

export default function ParasPage() {
  const pandals = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "pandals.json"), "utf8")
  );
  return (
    <main className="flex-grow">
      <PandalDirectory pandals={pandals} />
    </main>
  );
}
