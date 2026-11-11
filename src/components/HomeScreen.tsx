import type { TileValue } from '../game/types';
import type { PlayerProfile } from '../types/profile';
import { BottomNav } from './BottomNav';
import { DailyRewardCard } from './DailyRewardCard';
import { FloatingParticles } from './FloatingParticles';
import { getGoalProgress, getNextGoal, HighestBlockHero } from './HighestBlockHero';
import { PrimaryPlayButton } from './PrimaryPlayButton';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { StageProgressCard } from './StageProgressCard';
import { useDailyGiftStatus } from '../hooks/useDailyGiftStatus';

interface HomeProps {
  highestBlock: TileValue;
  level: number;
  levelProgress: number;
  gems: number;
  bestScore: number;
  profile: PlayerProfile;
  onPlay: () => void;
  onProfile: () => void;
  onShop: () => void;
  onRewards: () => void;
}

export function HomeScreen({ highestBlock, level, levelProgress, gems, bestScore, profile, onPlay, onProfile, onShop, onRewards }: HomeProps) {
  const daily = useDailyGiftStatus();
  const nextGoal = getNextGoal(highestBlock);
  const progress = getGoalProgress(highestBlock, nextGoal);
  return (
    <section className="home-screen">
      <FloatingParticles />
      <div className="home-content">
        <ProfileSummaryCard profile={profile} level={level} levelProgress={levelProgress} gems={gems} onOpenProfile={onProfile} />
        <DailyRewardCard onOpen={onRewards} />
        <HighestBlockHero highestBlock={highestBlock} />
        <StageProgressCard bestScore={bestScore} goal={nextGoal} progress={progress} />
        <PrimaryPlayButton onPlay={onPlay} />
      </div>
      <BottomNav onPlay={onPlay} onProfile={onProfile} onShop={onShop} onRewards={onRewards} rewardsReady={daily.hasReadyRewards} />
    </section>
  );
}
