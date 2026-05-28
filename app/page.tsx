import Workbench from "./components/Workbench";

// The page is a thin server shell; all interactivity lives in the Workbench
// client island.
export default function Page() {
  return <Workbench />;
}
