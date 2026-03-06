import { SCORE_BADGE_COLORS } from "../../constants";

export default function ScoreBadge({ score, rank }: { score: number; rank: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${SCORE_BADGE_COLORS[rank] || SCORE_BADGE_COLORS.D}`}>
      {rank} {score}
    </span>
  );
}
