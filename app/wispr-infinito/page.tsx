import { SCROLL_COPY } from "@/components/scroll/pathCopy";
import { InfiniteTextTrail } from "@/components/text-trail/infinite-text-trail";

export default function WisprInfinitoPage() {
  return (
    <div className="relative min-h-screen bg-[#12151c]">
      <InfiniteTextTrail
        text={SCROLL_COPY}
        fontSize={34}
        textColor="#ffffff"
        textOpacity={1}
        mouse
      />
    </div>
  );
}
