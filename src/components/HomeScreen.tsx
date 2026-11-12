import { useMemo, useState } from 'react';
import type { TileValue } from '../game/types';
import { readChallengeRunRecords, type ChallengeRunId } from '../game/challengeRuns';
import type { PlayerProfile } from '../types/profile';
import { BottomNav } from './BottomNav';
import { DailyRewardCard } from './DailyRewardCard';
import { DailySeedCard } from './DailySeedCard';
import { FloatingParticles } from './FloatingParticles';
import { getGoalProgress, getNextGoal, HighestBlockHero } from './HighestBlockHero';
import { PrimaryPlayButton } from './PrimaryPlayButton';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { StageProgressCard } from './StageProgressCard';
import { useDailyGiftStatus } from '../hooks/useDailyGiftStatus';
import { ChallengeRunsModal } from './ChallengeRunsModal';

interface HomeProps {
  highestBlock: TileValue;
  level: number;
  levelProgress: number;
  gems: number;
  bestScore: number;
  dailySeedDay: string;
  dailySeedBestScore: number;
  dailySeedLongestChain: number;
  dailySeedCanResume: boolean;
  profile: PlayerProfile;
  onPlay: () => void;
  onDailySeed: () => void;
  onChallengeRun: (id: ChallengeRunId) => void;
  onProfile: () => void;
  onShop: () => void;
  onRewards: () => void;
}

export function HomeScreen({ highestBlock, level, levelProgress, gems, bestScore, dailySeedDay, dailySeedBestScore, dailySeedLongestChain, dailySeedCanResume, profile, onPlay, onDailySeed, onChallengeRun, onProfile, onShop, onRewards }: HomeProps) {
  const [challengePickerOpen, setChallengePickerOpen] = useState(false);
  const challengeRecords = useMemo(() => readChallengeRunRecords(), [challengePickerOpen]);
  const daily = useDailyGiftStatus();
  const nextGoal = getNextGoal(highestBlock);
  const progress = getGoalProgress(highestBlock, nextGoal);
  return (
    <section className="home-screen">
      <FloatingParticles />
      <div className="home-content">
        <ProfileSummaryCard profile={profile} level={level} levelProgress={levelProgress} gems={gems} onOpenProfile={onProfile} />
        <DailyRewardCard onOpen={onRewards} />
        <DailySeedCard day={dailySeedDay} bestScore={dailySeedBestScore} longestChain={dailySeedLongestChain} canResume={dailySeedCanResume} onPlay={onDailySeed} />
        <HighestBlockHero highestBlock={highestBlock} />
        <StageProgressCard bestScore={bestScore} goal={nextGoal} progress={progress} onChallenges={() => setChallengePickerOpen(true)} />
        <PrimaryPlayButton onPlay={onPlay} />
      </div>
      <BottomNav onPlay={onPlay} onProfile={onProfile} onShop={onShop} onRewards={onRewards} rewardsReady={daily.hasReadyRewards} />
      {challengePickerOpen && <ChallengeRunsModal records={challengeRecords} onStart={(id) => { setChallengePickerOpen(false); onChallengeRun(id); }} onClose={() => setChallengePickerOpen(false)} />}
    </section>
  );
}
