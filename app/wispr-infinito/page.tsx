import { SCROLL_COPY } from "@/components/scroll/pathCopy";
import { InfiniteTextTrail } from "@/components/text-trail/infinite-text-trail";

export default function WisprInfinitoPage() {
  return (
    <div className="relative min-h-screen bg-white">
      <InfiniteTextTrail
        text={SCROLL_COPY}
        fontSize={34}
        textColor="#1A1A1A"
        textOpacity={1}
      />
    </div>
  );
}
