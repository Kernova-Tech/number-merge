import { useCallback, useEffect, useRef, useState } from 'react';
import { COLS, INITIAL_HIGHEST, REWARD_VALUES, ROWS } from '../game/constants';
import { cloneBoard, createDistinctInitialBoard, createEmptyBoard, createInitialBoard, removeRetiredTiles, resolveMerges, shootTile } from '../game/gameLogic';
import { createDailySeedOpening, getDailySeedDay, readDailySeedRecord, loadDailySeedRun, nextSeededRandom, recordDailySeedProgress, saveDailySeedRun } from '../game/dailySeed';
import type { DailySeedRecord, DailySeedRun, GameMode } from '../game/dailySeed';
import { loadRun } from '../game/savedRun';
import { getCurrentGoal, getMilestoneInfo, getRetiredValuesForHighest } from '../game/milestones';
import { generateWeightedTile, getActiveTilePool } from '../game/tileGeneration';
import { calculateMergeXp, calculateMilestoneXp, getLevelProgress, getTotalXpForLevel } from '../game/leveling';
import { getCrossedScoreCheckpoint } from '../game/adBreaks';
import type { Board, BoosterType, MergeAnimationState, MergeEvent, MilestoneInfo, ModalType, Position, ShotResult, TileValue } from '../game/types';
import { storage } from '../utils/storage';
import { createId } from '../utils/createId';
import { adsSupported, listenForAdResult, pendingAd, requestAd, requestInterstitialBreak, subscribeAdAvailability } from '../utils/rewardBridge';
import { collectChallenge, collectDaily, creditReward, purchaseBoosters, readWallet, recordChallengeMove, syncWallet } from '../game/economy';
import type { ChallengeId } from '../game/challenges';
import { DAILY_GIFTS } from '../game/dailyRewards';
import { getChallengeRun, getChallengeRunOutcome, readChallengeRunRecord, recordChallengeRun } from '../game/challengeRuns';
import type { ChallengeRunId, ChallengeRunOutcome, ChallengeRunStats } from '../game/challengeRuns';

interface Snapshot {
  board: Board;
  score: number;
  currentTile: TileValue;
  nextTile: TileValue;
  highestBlock: TileValue;
  totalXp: number;
}

export interface GameEngine {
  screen: 'home' | 'game';
  mode: GameMode;
  challengeId: ChallengeRunId | null;
  challengeOutcome: Exclude<ChallengeRunOutcome, null> | null;
  challengeBestScore: number;
  runStats: ChallengeRunStats;
  challengeMovesRemaining: number;
  dailySeedDay: string;
  dailySeedBestScore: number;
  dailySeedLongestChain: number;
  dailySeedRunLongestChain: number;
  dailySeedRunBestAtStart: number;
  dailySeedCanResume: boolean;
  board: Board;
  currentTile: TileValue;
  nextTile: TileValue;
  selectedColumn: number;
  score: number;
  bestScore: number;
  gems: number;
  highestBlock: TileValue;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  levelProgress: number;
  boosters: Record<BoosterType, number>;
  modal: ModalType;
  modalTile: TileValue | null;
  milestoneInfo: MilestoneInfo | null;
  retiredTiles: TileValue[];
  tutorialStep: number;
  hammerActive: boolean;
  isShooting: boolean;
  isPromotingNextTile: boolean;
  isResolvingMerge: boolean;
  shotTile: TileValue | null;
  shotTargetColumn: number;
  shotTargetRow: number;
  shotDuration: number;
  mergeEvents: MergeEvent[];
  mergeAnimation: MergeAnimationState | null;
  combo: number;
  currentGoal: number;
  startGame: () => void;
  startDailySeed: () => void;
  startChallengeRun: (id: ChallengeRunId) => void;
  goHome: () => void;
  restart: () => void;
  shoot: (column?: number) => void;
  selectColumn: (column: number) => void;
  moveSelection: (delta: number) => void;
  pause: () => void;
  resume: () => void;
  useBooster: (type: BoosterType) => void;
  hitWithHammer: (position: Position) => void;
  skipTutorial: () => void;
  closeGoal: () => void;
  claimUnlock: (double: boolean) => void;
  closeMilestone: () => void;
  adBusy: boolean;
  adAvailable: boolean;
  adBreakScore: number | null;
  requestAdBreak: (score: number) => string | null;
  finishAdBreak: () => void;
  watchForBooster: (type: BoosterType) => void;
  buyBooster: (type: BoosterType) => void;
  setBoosterOfferOpen: (open: boolean) => void;
  purchaseShopItem: (item: BoosterType | 'bundle') => boolean;
  collectDailyGift: (double?: boolean) => boolean;
  collectChallengeReward: (id: ChallengeId) => boolean;
  resolveCreatedAgain: (upgrade: boolean) => void;
}

const PROMOTION_DURATION = 500;
const MERGE_CONNECT_DURATION = 240;
const MERGE_POP_DURATION = 180;
const MERGE_CHAIN_PAUSE = 70;

export function useGameEngine(): GameEngine {
  const [initialRun] = useState(loadRun);
  const savedRun = useRef(initialRun);
  const [initialRunId] = useState(() => initialRun?.runId ?? createId());
  const runId = useRef(initialRunId);
  const moveNumber = useRef(initialRun?.moveNumber ?? 0);
  const lastAdBreakCheckpoint = useRef(initialRun?.lastAdBreakCheckpoint ?? 0);
  const [runActive, setRunActive] = useState(false);
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [challengeId, setChallengeId] = useState<ChallengeRunId | null>(null);
  const [challengeOutcome, setChallengeOutcome] = useState<Exclude<ChallengeRunOutcome, null> | null>(null);
  const [challengeBestScore, setChallengeBestScore] = useState(0);
  const [dailySeedDay, setDailySeedDay] = useState(() => getDailySeedDay());
  const [dailySeedRecord, setDailySeedRecord] = useState<DailySeedRecord>(() => readDailySeedRecord(getDailySeedDay()));
  const [dailySeedRunLongestChain, setDailySeedRunLongestChain] = useState(0);
  const [initialDailyRun] = useState(loadDailySeedRun);
  const [dailySeedRunBestAtStart, setDailySeedRunBestAtStart] = useState(() => initialDailyRun?.bestScoreAtStart ?? 0);
  const dailyRunRef = useRef<DailySeedRun | null>(initialDailyRun);
  const dailyRandomStateRef = useRef(initialDailyRun?.randomState ?? 0);
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [currentTile, setCurrentTile] = useState<TileValue>(2);
  const [nextTile, setNextTile] = useState<TileValue>(4);
  const [selectedColumn, setSelectedColumn] = useState(2);
  const [score, setScore] = useState(0);
  const initialStats: ChallengeRunStats = initialRun?.runStats ?? {
    shots: 0,
    highestTile: initialRun ? Math.max(INITIAL_HIGHEST, ...initialRun.board.flat().filter((value): value is number => value !== null)) : INITIAL_HIGHEST,
    longestCascade: 0,
  };
  const [runStats, setRunStats] = useState<ChallengeRunStats>(initialStats);
  const runStatsRef = useRef<ChallengeRunStats>(initialStats);
  const [bestScore, setBestScore] = useState(() => storage.get('best-score', 0));
  const [gems, setGems] = useState(() => readWallet().gems);
  const [highestBlock, setHighestBlock] = useState<TileValue>(() => storage.get('highest-block', INITIAL_HIGHEST));
  const [totalXp, setTotalXp] = useState(() => {
    const savedLevel = storage.get('level', 1);
    return storage.get('total-xp', getTotalXpForLevel(savedLevel));
  });
  const [boosters, setBoosters] = useState(() => readWallet().boosters);
  const [adBusy, setAdBusy] = useState(() => pendingAd() !== null);
  const [adAvailable, setAdAvailable] = useState(adsSupported);
  const claimLock = useRef(false);
  const rewardTileRef = useRef<number | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [modalTile, setModalTile] = useState<TileValue | null>(null);
  rewardTileRef.current = modalTile;
  const [milestoneInfo, setMilestoneInfo] = useState<MilestoneInfo | null>(null);
  const [adBreakScore, setAdBreakScore] = useState<number | null>(null);
  const [queuedAdBreakCheckpoint, setQueuedAdBreakCheckpoint] = useState<number | null>(() => initialRun?.queuedAdBreakCheckpoint ?? null);
  const queuedAdBreakCheckpointRef = useRef<number | null>(initialRun?.queuedAdBreakCheckpoint ?? null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [hammerActive, setHammerActive] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [isPromotingNextTile, setIsPromotingNextTile] = useState(false);
  const [isResolvingMerge, setIsResolvingMerge] = useState(false);
  const [shotTileValue, setShotTileValue] = useState<TileValue | null>(null);
  const [shotTargetColumn, setShotTargetColumn] = useState(2);
  const [shotTargetRow, setShotTargetRow] = useState(0);
  const [shotDuration, setShotDuration] = useState(300);
  const [mergeEvents, setMergeEvents] = useState<MergeEvent[]>([]);
  const [mergeAnimation, setMergeAnimation] = useState<MergeAnimationState | null>(null);
  const [combo, setCombo] = useState(0);
  const historyRef = useRef<Snapshot[]>([]);
  const pendingPosition = useRef<Position | null>(null);
  const pendingTutorialTimer = useRef<number | null>(null);
  const promotionTimer = useRef<number | null>(null);
  const mergeTimer = useRef<number | null>(null);

  const replaceRunStats = useCallback((stats: ChallengeRunStats) => {
    runStatsRef.current = stats;
    setRunStats(stats);
    return stats;
  }, []);
  const updateRunStats = useCallback((update: (stats: ChallengeRunStats) => ChallengeRunStats) => {
    const next = update(runStatsRef.current);
    runStatsRef.current = next;
    setRunStats(next);
    return next;
  }, []);

  // Single source of truth: highestBlock. Both the current goal and the set of
  // retired tiles are derived from it — so a retired number can never reappear
  // and the two systems can never drift apart.
  const currentGoal = getCurrentGoal(highestBlock);
  const retiredTiles = getRetiredValuesForHighest(highestBlock);
  const levelState = getLevelProgress(totalXp);
  const level = levelState.level;

  queuedAdBreakCheckpointRef.current = queuedAdBreakCheckpoint;

  const releaseQueuedAdBreak = useCallback(() => {
    const checkpoint = queuedAdBreakCheckpointRef.current;
    if (checkpoint === null) return false;
    queuedAdBreakCheckpointRef.current = null;
    setQueuedAdBreakCheckpoint(null);
    setAdBreakScore(checkpoint);
    setModal('ad-break');
    return true;
  }, []);

  const queueOrShowAdBreak = useCallback((checkpoint: number | null, waitForReward = false) => {
    if (checkpoint === null || checkpoint <= lastAdBreakCheckpoint.current) return;
    lastAdBreakCheckpoint.current = checkpoint;
    if (waitForReward) {
      queuedAdBreakCheckpointRef.current = checkpoint;
      setQueuedAdBreakCheckpoint(checkpoint);
      return;
    }
    setAdBreakScore(checkpoint);
    setModal('ad-break');
  }, []);

  useEffect(() => { if (gameMode === 'classic') storage.set('best-score', bestScore); }, [bestScore, gameMode]);
  useEffect(() => storage.set('gems', gems), [gems]);
  useEffect(() => { if (gameMode === 'classic') storage.set('highest-block', highestBlock); }, [gameMode, highestBlock]);
  useEffect(() => storage.set('level', level), [level]);
  useEffect(() => { if (gameMode === 'classic') storage.set('total-xp', totalXp); }, [gameMode, totalXp]);
  useEffect(() => storage.set('boosters', boosters), [boosters]);
  useEffect(() => syncWallet(gems, boosters), [gems, boosters]);
  useEffect(() => {
    if (screen !== 'home') return;
    const refreshDailyRecord = () => {
      const today = getDailySeedDay();
      setDailySeedDay((current) => current === today ? current : today);
      setDailySeedRecord((current) => current.day === today ? current : readDailySeedRecord(today));
    };
    const timer = window.setInterval(refreshDailyRecord, 60_000);
    document.addEventListener('visibilitychange', refreshDailyRecord);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDailyRecord);
    };
  }, [screen]);
  useEffect(() => subscribeAdAvailability(() => setAdAvailable(adsSupported())), []);
  useEffect(() => listenForAdResult((request, result) => {
    if (result.status === 'earned') {
      if (request.placement === 'milestone_double' && request.milestone) {
        creditReward(`milestone:${request.milestone}`, REWARD_VALUES[request.milestone] ?? 10);
        const wallet = creditReward(`milestone-bonus:${request.milestone}`, REWARD_VALUES[request.milestone] ?? 10);
        setGems(wallet.gems);
        if (savedRun.current?.modalTile === request.milestone) {
          savedRun.current = { ...savedRun.current, rewardModal: null, modalTile: null, milestoneInfo: null };
          storage.set('saved-run', savedRun.current);
        }
        if (rewardTileRef.current === request.milestone) {
          setMilestoneInfo(null);
          if (!releaseQueuedAdBreak()) setModal(current => current === 'unlock' || current === 'milestone' ? null : current);
        }
      } else if (request.placement === 'booster_refill' && request.booster) {
        const wallet = creditReward(`ad:${request.requestId}`, 0, request.booster);
        setBoosters(wallet.boosters);
      } else if (request.placement === 'daily_double' && request.dailyId && request.dailyIndex !== undefined) {
        const gift = DAILY_GIFTS[request.dailyIndex];
        if (gift && gift.gems > 0 && !gift.booster) {
          const wallet = creditReward(`bonus:${request.dailyId}`, gift.gems);
          setGems(wallet.gems);
        }
      }
    } else {
      window.dispatchEvent(new CustomEvent('merge-toast', { detail: request.placement === 'milestone_double'
        ? 'Collection not completed. Your normal reward is still available.'
        : request.placement === 'daily_double' ? 'Your daily gift was collected. The extra bonus was not completed.'
        : 'Collection not completed. No booster was added; you can try again or buy with gems.' }));
    }
    claimLock.current = false;
    setAdBusy(!!pendingAd() && pendingAd()?.requestId !== request.requestId);
  }, () => {
    claimLock.current = false;
    setAdBusy(false);
    window.dispatchEvent(new CustomEvent('merge-toast', { detail: 'Collection is taking longer than expected. You can continue; an earned reward will still be delivered.' }));
  }, () => {
    setAdBreakScore(null);
    setModal(current => current === 'ad-break' ? null : current);
  }), [releaseQueuedAdBreak]);
  useEffect(() => {
    if (gameMode !== 'classic' || !runActive || screen !== 'game' || tutorialStep > 0 || isShooting || isResolvingMerge || isPromotingNextTile) return;
    if (modal === 'game-over') {
      storage.set('saved-run', null);
      savedRun.current = null;
      return;
    }
    const rewardModal = modal === 'unlock' || modal === 'milestone' ? modal : null;
    const run = { version: 1 as const, board: cloneBoard(board), score, currentTile, nextTile, selectedColumn, highestBlock, totalXp, runStats, rewardModal, modalTile, milestoneInfo, runId: runId.current, moveNumber: moveNumber.current, lastAdBreakCheckpoint: lastAdBreakCheckpoint.current, queuedAdBreakCheckpoint, adBreakCheckpoint: modal === 'ad-break' ? adBreakScore : null };
    savedRun.current = run;
    storage.set('saved-run', run);
  }, [gameMode, runActive, screen, tutorialStep, isShooting, isResolvingMerge, isPromotingNextTile, modal, board, score, currentTile, nextTile, selectedColumn, highestBlock, totalXp, runStats, modalTile, milestoneInfo, queuedAdBreakCheckpoint, adBreakScore]);
  useEffect(() => {
    if (gameMode !== 'daily-seed' || !runActive) return;
    if (modal === 'daily-result') {
      dailyRunRef.current = null;
      saveDailySeedRun(null);
      return;
    }
    if (screen !== 'game' || tutorialStep > 0 || isShooting || isResolvingMerge || isPromotingNextTile) return;
    const run: DailySeedRun = {
      version: 1,
      day: dailySeedDay,
      seed: dailyRunRef.current?.seed ?? 0,
      randomState: dailyRandomStateRef.current,
      board: cloneBoard(board),
      score,
      currentTile,
      nextTile,
      selectedColumn,
      highestBlock,
      longestChain: dailySeedRunLongestChain,
      bestScoreAtStart: dailySeedRunBestAtStart,
    };
    dailyRunRef.current = run;
    saveDailySeedRun(run);
  }, [gameMode, runActive, modal, screen, tutorialStep, isShooting, isResolvingMerge, isPromotingNextTile, dailySeedDay, board, score, currentTile, nextTile, selectedColumn, highestBlock, dailySeedRunLongestChain, dailySeedRunBestAtStart]);
  useEffect(() => {
    if (modal === 'created-again') setModal(null);
  }, [modal]);

  useEffect(() => () => {
    if (pendingTutorialTimer.current) window.clearTimeout(pendingTutorialTimer.current);
    if (promotionTimer.current) window.clearTimeout(promotionTimer.current);
    if (mergeTimer.current) window.clearTimeout(mergeTimer.current);
  }, []);

  // Current and next always share the same highest-block-driven weighted pool.
  const spawnTile = useCallback((highest: number, exclude: TileValue[] = [], seeded = gameMode === 'daily-seed'): TileValue => {
    const random = seeded ? () => {
      const next = nextSeededRandom(dailyRandomStateRef.current);
      dailyRandomStateRef.current = next.state;
      return next.value;
    } : Math.random;
    return generateWeightedTile(highest, random, exclude);
  }, [gameMode]);

  const setupNormalGame = useCallback((previousBoard?: Board, previousShooter?: TileValue, highest = highestBlock) => {
    setGameMode('classic');
    setChallengeId(null);
    setChallengeOutcome(null);
    runId.current = createId();
    moveNumber.current = 0;
    lastAdBreakCheckpoint.current = 0;
    queuedAdBreakCheckpointRef.current = null;
    setRunActive(true);
    if (promotionTimer.current) window.clearTimeout(promotionTimer.current);
    if (pendingTutorialTimer.current) window.clearTimeout(pendingTutorialTimer.current);
    if (mergeTimer.current) window.clearTimeout(mergeTimer.current);
    const retired = getRetiredValuesForHighest(highest);
    const initialBoard = previousBoard ? createDistinctInitialBoard(previousBoard, retired) : createInitialBoard(retired);
    const readyBoard = resolveMerges(initialBoard, { row: 0, col: 0 }, highest, { scanWholeBoard: true }).board;
    setBoard(readyBoard);
    replaceRunStats({ shots: 0, highestTile: Math.max(INITIAL_HIGHEST, ...readyBoard.flat().filter((value): value is TileValue => value !== null)), longestCascade: 0 });
    setScore(0);
    const firstTile = spawnTile(highest, previousShooter ? [previousShooter] : [], false);
    const followingTile = spawnTile(highest, [firstTile], false);
    setCurrentTile(firstTile);
    setNextTile(followingTile);
    setSelectedColumn(2);
    setTutorialStep(0);
    setModal(null);
    setAdBreakScore(null);
    setQueuedAdBreakCheckpoint(null);
    setHammerActive(false);
    setIsShooting(false);
    setIsPromotingNextTile(false);
    setIsResolvingMerge(false);
    setMergeAnimation(null);
    historyRef.current = [];
  }, [highestBlock, replaceRunStats, spawnTile]);

  const setupDailySeedGame = useCallback((day: string, resumeSaved: boolean) => {
    const saved = resumeSaved ? loadDailySeedRun(day) : null;
    const record = readDailySeedRecord(day);
    const opening = saved ?? (() => {
      const generated = createDailySeedOpening(day);
      return {
        version: 1 as const,
        day,
        ...generated,
        score: 0,
        selectedColumn: 2,
        longestChain: 0,
        bestScoreAtStart: record.bestScore,
      };
    })();
    setGameMode('daily-seed');
    setChallengeId(null);
    setChallengeOutcome(null);
    setScreen('game');
    setRunActive(true);
    setDailySeedDay(day);
    setDailySeedRecord(record);
    setDailySeedRunLongestChain(opening.longestChain);
    setDailySeedRunBestAtStart(opening.bestScoreAtStart);
    dailyRunRef.current = opening;
    dailyRandomStateRef.current = opening.randomState;
    saveDailySeedRun(opening);
    if (promotionTimer.current) window.clearTimeout(promotionTimer.current);
    if (pendingTutorialTimer.current) window.clearTimeout(pendingTutorialTimer.current);
    if (mergeTimer.current) window.clearTimeout(mergeTimer.current);
    runId.current = createId();
    moveNumber.current = 0;
    setBoard(cloneBoard(opening.board));
    replaceRunStats({ shots: 0, highestTile: Math.max(INITIAL_HIGHEST, ...opening.board.flat().filter((value): value is TileValue => value !== null)), longestCascade: opening.longestChain });
    setScore(opening.score);
    setCurrentTile(opening.currentTile);
    setNextTile(opening.nextTile);
    setSelectedColumn(opening.selectedColumn);
    setHighestBlock(opening.highestBlock);
    setTutorialStep(0);
    setModal(null);
    setModalTile(null);
    setMilestoneInfo(null);
    setAdBreakScore(null);
    setQueuedAdBreakCheckpoint(null);
    queuedAdBreakCheckpointRef.current = null;
    setHammerActive(false);
    setIsShooting(false);
    setIsPromotingNextTile(false);
    setIsResolvingMerge(false);
    setShotTileValue(null);
    setMergeEvents([]);
    setMergeAnimation(null);
    setCombo(0);
    historyRef.current = [];
  }, [replaceRunStats]);

  const setupChallengeRun = useCallback((id: ChallengeRunId) => {
    if (promotionTimer.current) window.clearTimeout(promotionTimer.current);
    if (pendingTutorialTimer.current) window.clearTimeout(pendingTutorialTimer.current);
    if (mergeTimer.current) window.clearTimeout(mergeTimer.current);
    runId.current = createId();
    moveNumber.current = 0;
    lastAdBreakCheckpoint.current = 0;
    queuedAdBreakCheckpointRef.current = null;
    setQueuedAdBreakCheckpoint(null);
    setGameMode('challenge');
    setChallengeId(id);
    setChallengeOutcome(null);
    setChallengeBestScore(readChallengeRunRecord(id).bestScore);
    setScreen('game');
    setRunActive(true);
    const openingBoard = resolveMerges(createInitialBoard(), { row: 0, col: 0 }, INITIAL_HIGHEST, { scanWholeBoard: true }).board;
    setBoard(openingBoard);
    setScore(0);
    setHighestBlock(INITIAL_HIGHEST);
    const firstTile = spawnTile(INITIAL_HIGHEST, [], false);
    setCurrentTile(firstTile);
    setNextTile(spawnTile(INITIAL_HIGHEST, [firstTile], false));
    setSelectedColumn(2);
    replaceRunStats({ shots: 0, highestTile: Math.max(INITIAL_HIGHEST, ...openingBoard.flat().filter((value): value is TileValue => value !== null)), longestCascade: 0 });
    setTutorialStep(0);
    setModal(null);
    setModalTile(null);
    setMilestoneInfo(null);
    setAdBreakScore(null);
    setHammerActive(false);
    setIsShooting(false);
    setIsPromotingNextTile(false);
    setIsResolvingMerge(false);
    setShotTileValue(null);
    setMergeEvents([]);
    setMergeAnimation(null);
    setCombo(0);
    historyRef.current = [];
  }, [replaceRunStats, spawnTile]);

  const startDailySeed = useCallback(() => {
    if (pendingAd()) return;
    setupDailySeedGame(getDailySeedDay(), true);
  }, [setupDailySeedGame]);

  const startChallengeRun = useCallback((id: ChallengeRunId) => {
    if (pendingAd()) return;
    setupChallengeRun(id);
  }, [setupChallengeRun]);

  const startGame = useCallback(() => {
    const returningFromAnotherMode = gameMode !== 'classic';
    setGameMode('classic');
    setChallengeId(null);
    setChallengeOutcome(null);
    setScreen('game');
    const saved = savedRun.current;
    if (saved) {
      setBoard(cloneBoard(saved.board));
      replaceRunStats(saved.runStats ?? {
        shots: 0,
        highestTile: Math.max(INITIAL_HIGHEST, ...saved.board.flat().filter((value): value is TileValue => value !== null)),
        longestCascade: 0,
      });
      setScore(saved.score);
      setCurrentTile(saved.currentTile);
      setNextTile(saved.nextTile);
      setSelectedColumn(saved.selectedColumn);
      setHighestBlock(saved.highestBlock);
      setTotalXp(saved.totalXp);
      lastAdBreakCheckpoint.current = saved.lastAdBreakCheckpoint ?? 0;
      queuedAdBreakCheckpointRef.current = saved.queuedAdBreakCheckpoint ?? null;
      setQueuedAdBreakCheckpoint(saved.queuedAdBreakCheckpoint ?? null);
      setAdBreakScore(saved.adBreakCheckpoint ?? null);
      setTutorialStep(0);
      setModal(saved.adBreakCheckpoint ? 'ad-break' : saved.rewardModal ?? null);
      setModalTile(saved.modalTile ?? null);
      setMilestoneInfo(saved.milestoneInfo ?? null);
      setRunActive(true);
      return;
    }
    const classicHighest = storage.get('highest-block', INITIAL_HIGHEST);
    setHighestBlock(classicHighest);
    if (!storage.get('tutorial-complete', false) && !getRetiredValuesForHighest(classicHighest).includes(2)) {
      const tutorialBoard = createEmptyBoard();
      setBoard(tutorialBoard);
      replaceRunStats({ shots: 0, highestTile: INITIAL_HIGHEST, longestCascade: 0 });
      setScore(0);
      setCurrentTile(2);
      setNextTile(2);
      setSelectedColumn(2);
      setTutorialStep(1);
      setModal(null);
      historyRef.current = [];
    } else {
      setupNormalGame(returningFromAnotherMode ? undefined : board, returningFromAnotherMode ? undefined : currentTile, classicHighest);
    }
  }, [board, currentTile, gameMode, replaceRunStats, setupNormalGame]);

  const goHome = useCallback(() => {
    if (isShooting || isPromotingNextTile || isResolvingMerge) return;
    if (promotionTimer.current) window.clearTimeout(promotionTimer.current);
    if (pendingTutorialTimer.current) window.clearTimeout(pendingTutorialTimer.current);
    if (mergeTimer.current) window.clearTimeout(mergeTimer.current);
    setModal(null);
    setScreen('home');
    const today = getDailySeedDay();
    setDailySeedDay(today);
    setDailySeedRecord(readDailySeedRecord(today));
    if (gameMode !== 'classic') {
      setHighestBlock(savedRun.current?.highestBlock ?? storage.get('highest-block', INITIAL_HIGHEST));
    }
    setTutorialStep(0);
    setIsShooting(false);
    setIsPromotingNextTile(false);
    setIsResolvingMerge(false);
    setMergeAnimation(null);
  }, [gameMode, isShooting, isPromotingNextTile, isResolvingMerge]);

  const restart = useCallback(() => {
    if (gameMode === 'daily-seed') {
      setupDailySeedGame(getDailySeedDay(), false);
      return;
    }
    if (gameMode === 'challenge') {
      setupChallengeRun(challengeId ?? 'milestone-sprint');
      return;
    }
    setScreen('game');
    setupNormalGame(board, currentTile);
  }, [board, challengeId, currentTile, gameMode, setupChallengeRun, setupDailySeedGame, setupNormalGame]);

  const finishTutorial = useCallback(() => {
    storage.set('tutorial-complete', true);
    setTutorialStep(5);
    setModal('first-goal');
  }, []);

  const skipTutorial = useCallback(() => {
    storage.set('tutorial-complete', true);
    setupNormalGame(board, currentTile);
  }, [board, currentTile, setupNormalGame]);

  const closeGoal = useCallback(() => {
    setupNormalGame(board, currentTile);
  }, [board, currentTile, setupNormalGame]);

  const shoot = useCallback((requestedColumn?: number) => {
    if (pendingAd() || screen !== 'game' || modal || isShooting || isPromotingNextTile || isResolvingMerge || hammerActive) return;
    if (tutorialStep === 2 || tutorialStep === 4 || tutorialStep === 5) return;
    const column = tutorialStep > 0 ? 2 : Math.max(0, Math.min(COLS - 1, requestedColumn ?? selectedColumn));
    const tile = currentTile;
    const before: Snapshot = { board: cloneBoard(board), score, currentTile, nextTile, highestBlock, totalXp };
    let columnHeight = 0;
    while (columnHeight < ROWS && board[columnHeight][column] !== null) columnHeight += 1;
    // The shot occupies the next cell below a matching collision as well.
    const targetRow = Math.min(columnHeight, ROWS - 1);
    const flightDuration = 250 + (ROWS - 1 - targetRow) * 18;
    const result = shootTile(board, column, tile, highestBlock);
    const shotStats = tutorialStep === 0
      ? updateRunStats((stats) => ({
        shots: stats.shots + 1,
        highestTile: Math.max(stats.highestTile, ...result.merges.map((merge) => merge.value)),
        longestCascade: Math.max(stats.longestCascade, result.merges.length),
      }))
      : runStatsRef.current;
    setSelectedColumn(column);
    setIsShooting(true);
    setShotTileValue(tile);
    setShotTargetColumn(column);
    setShotTargetRow(targetRow);
    setShotDuration(flightDuration);
    setMergeEvents([]);
    setMergeAnimation(null);

    const promoteAndFinish = (shotResult: ShotResult, nextScore: number) => {
      setBoard(shotResult.board);
      setIsResolvingMerge(false);
      setMergeAnimation(null);
      setIsShooting(false);
      setShotTileValue(null);
      window.setTimeout(() => {
        setMergeEvents([]);
        setCombo(0);
      }, 850);

      if (tutorialStep === 1) {
        setCurrentTile(nextTile);
        setIsPromotingNextTile(true);
        promotionTimer.current = window.setTimeout(() => {
          setNextTile(2);
          setIsPromotingNextTile(false);
          setTutorialStep(2);
          pendingTutorialTimer.current = window.setTimeout(() => setTutorialStep(3), 1250);
        }, PROMOTION_DURATION);
        return;
      }
      if (tutorialStep === 3) {
        setCurrentTile(nextTile);
        setIsPromotingNextTile(true);
        promotionTimer.current = window.setTimeout(() => {
          setNextTile(2);
          setIsPromotingNextTile(false);
          setTutorialStep(4);
          pendingTutorialTimer.current = window.setTimeout(finishTutorial, 1250);
        }, PROMOTION_DURATION);
        return;
      }

      const created = shotResult.merges.length ? Math.max(...shotResult.merges.map((merge) => merge.value)) : undefined;
      const isNewRecord = created !== undefined && created > highestBlock;
      const scoreCheckpoint = gameMode === 'classic' ? getCrossedScoreCheckpoint(score, nextScore) : null;

      // The next queue immediately adopts the pool unlocked by this shot.
      const nextHighest = isNewRecord ? (created as TileValue) : highestBlock;
      // Honor the queue: the tile shown in NEXT becomes the new origin tile.
      // Only re-roll if this shot's milestone just retired that exact value.
      const nextActivePool = getActiveTilePool(nextHighest);
      const promotedTile = !nextActivePool.includes(nextTile)
        ? spawnTile(nextHighest, [])
        : nextTile;
      const generatedNextTile = spawnTile(nextHighest, [promotedTile]);

      setCurrentTile(promotedTile);
      setIsPromotingNextTile(true);

      promotionTimer.current = window.setTimeout(() => {
        setNextTile(generatedNextTile);
        setIsPromotingNextTile(false);
        if (gameMode === 'classic') recordChallengeMove(`${runId.current}:${++moveNumber.current}`, shotResult.merges);

        if (gameMode === 'daily-seed') {
          const longestChain = Math.max(dailySeedRunLongestChain, shotResult.merges.length);
          setDailySeedRunLongestChain(longestChain);
          const record = recordDailySeedProgress(dailySeedDay, nextScore, longestChain);
          setDailySeedRecord(record);
          setHighestBlock(nextHighest);
          if (shotResult.gameOver) {
            dailyRunRef.current = null;
            saveDailySeedRun(null);
            setModal('daily-result');
          }
          return;
        }

        if (gameMode === 'challenge') {
          const id = challengeId ?? 'milestone-sprint';
          const outcome = getChallengeRunOutcome(id, shotStats, shotResult.gameOver);
          setHighestBlock(nextHighest);
          if (outcome) {
            const record = recordChallengeRun(id, shotStats, nextScore, outcome);
            setChallengeBestScore(record.bestScore);
            setChallengeOutcome(outcome);
            setModal('challenge-result');
          }
          return;
        }

        if (shotResult.gameOver) {
          setModal('game-over');
          return;
        }

        if (isNewRecord) {
          if (getRetiredValuesForHighest(nextHighest).length > retiredTiles.length) historyRef.current = [];
          setHighestBlock(nextHighest);
          setModalTile(nextHighest);
          // A milestone is "reached" the first time we cross it — i.e. its
          // retired tile is newly retired (not already gone before this shot).
          const createdMilestone = getMilestoneInfo(nextHighest);
          const reachedMilestone = createdMilestone && !retiredTiles.includes(createdMilestone.retired)
            ? createdMilestone
            : null;
          if (reachedMilestone) {
            setMilestoneInfo(reachedMilestone);
            setModal('milestone');
          } else {
            setModal('unlock');
          }
          pendingPosition.current = shotResult.landing;
          queueOrShowAdBreak(scoreCheckpoint, true);
        } else {
          queueOrShowAdBreak(scoreCheckpoint);
        }
      }, PROMOTION_DURATION);
    };

    const playMergeStep = (shotResult: ShotResult, index: number, nextScore: number) => {
      const step = shotResult.mergeSteps[index];
      if (!step) {
        promoteAndFinish(shotResult, nextScore);
        return;
      }

      setBoard(step.boardBefore);
      setMergeAnimation({ step, phase: 'connecting' });
      mergeTimer.current = window.setTimeout(() => {
        setIsShooting(false);
        setShotTileValue(null);
        setBoard(step.boardAfter);
        setMergeEvents([{ ...step.result, value: step.value, shape: step.shape, tileCount: step.tileCount }]);
        setMergeAnimation({ step, phase: 'popping' });
        mergeTimer.current = window.setTimeout(() => {
          setMergeAnimation(null);
          mergeTimer.current = window.setTimeout(
            () => playMergeStep(shotResult, index + 1, nextScore),
            MERGE_CHAIN_PAUSE,
          );
        }, MERGE_POP_DURATION);
      }, MERGE_CONNECT_DURATION);
    };

    window.setTimeout(() => {
      if (result.gameOver && result.landing === null) {
        setIsShooting(false);
        setShotTileValue(null);
        if (gameMode === 'challenge') {
          const id = challengeId ?? 'milestone-sprint';
          const record = recordChallengeRun(id, shotStats, score, 'failed');
          setChallengeBestScore(record.bestScore);
          setChallengeOutcome('failed');
          setModal('challenge-result');
          return;
        }
        if (gameMode === 'daily-seed') {
          dailyRunRef.current = null;
          saveDailySeedRun(null);
        }
        setModal(gameMode === 'daily-seed' ? 'daily-result' : 'game-over');
        return;
      }

      historyRef.current = [...historyRef.current.slice(-9), before];
      const nextScore = score + result.scoreGained;
      const created = result.merges.length ? Math.max(...result.merges.map((merge) => merge.value)) : undefined;
      const earnedXp = calculateMergeXp(result.merges)
        + (created && created > highestBlock ? calculateMilestoneXp(highestBlock, created) : 0);
      setScore(nextScore);
      if (gameMode === 'classic') {
        setTotalXp((xp) => xp + earnedXp);
        setBestScore((oldBest) => Math.max(oldBest, nextScore));
      }
      setCombo(result.merges.length);
      if (result.mergeSteps.length) {
        setIsResolvingMerge(true);
        playMergeStep(result, 0, nextScore);
      } else {
        setIsShooting(false);
        setShotTileValue(null);
        promoteAndFinish(result, nextScore);
      }
    }, flightDuration);
  }, [board, challengeId, currentTile, dailySeedDay, dailySeedRunLongestChain, finishTutorial, gameMode, hammerActive, highestBlock, isPromotingNextTile, isResolvingMerge, isShooting, modal, nextTile, queueOrShowAdBreak, retiredTiles, score, screen, selectedColumn, spawnTile, totalXp, tutorialStep, updateRunStats]);

  const selectColumn = useCallback((column: number) => {
    if (isShooting || isPromotingNextTile || isResolvingMerge) return;
    setSelectedColumn(Math.max(0, Math.min(COLS - 1, column)));
  }, [isPromotingNextTile, isResolvingMerge, isShooting]);
  const moveSelection = useCallback((delta: number) => {
    if (isShooting || isPromotingNextTile || isResolvingMerge) return;
    setSelectedColumn((column) => Math.max(0, Math.min(COLS - 1, column + delta)));
  }, [isPromotingNextTile, isResolvingMerge, isShooting]);

  const pause = useCallback(() => {
    if (!isShooting && !isPromotingNextTile && !isResolvingMerge && !modal) setModal('pause');
  }, [isPromotingNextTile, isResolvingMerge, isShooting, modal]);
  const resume = useCallback(() => setModal(null), []);
  const requestAdBreak = useCallback((checkpointScore: number) => requestInterstitialBreak(checkpointScore), []);
  const finishAdBreak = useCallback(() => {
    setAdBreakScore(null);
    setModal(current => current === 'ad-break' ? null : current);
  }, []);

  const useBooster = useCallback((type: BoosterType) => {
    if (gameMode !== 'classic' || pendingAd() || modal || isShooting || isPromotingNextTile || isResolvingMerge || tutorialStep > 0 || boosters[type] <= 0) return;
    if (type === 'hammer') {
      setHammerActive((active) => !active);
      return;
    }
    if (type === 'swap') {
      setBoosters((counts) => ({ ...counts, swap: counts.swap - 1 }));
      setCurrentTile(nextTile);
      setNextTile(spawnTile(highestBlock, [nextTile]));
      return;
    }
    const previous = historyRef.current.at(-1);
    if (!previous) return;
    historyRef.current = historyRef.current.slice(0, -1);
    const activePoolForUndo = getActiveTilePool(highestBlock);
    setBoosters((counts) => ({ ...counts, undo: counts.undo - 1 }));
    setBoard(removeRetiredTiles(previous.board, highestBlock));
    setScore(previous.score);
    setTotalXp(previous.totalXp);
    // Restore the exact tiles the player had, unless they are now retired.
    const restoredCurrent = !activePoolForUndo.includes(previous.currentTile)
      ? spawnTile(highestBlock, [])
      : previous.currentTile;
    const restoredNext = !activePoolForUndo.includes(previous.nextTile) || previous.nextTile === restoredCurrent
      ? spawnTile(highestBlock, [restoredCurrent])
      : previous.nextTile;
    setCurrentTile(restoredCurrent);
    setNextTile(restoredNext);
  }, [boosters, gameMode, highestBlock, isPromotingNextTile, isResolvingMerge, isShooting, modal, nextTile, spawnTile, tutorialStep]);

  const hitWithHammer = useCallback(({ row, col }: Position) => {
    if (gameMode !== 'classic' || !hammerActive || board[row][col] === null) return;
    const next = cloneBoard(board);
    next[row][col] = null;
    for (let column = 0; column < COLS; column += 1) {
      const values = next.map((line) => line[column]).filter((value): value is TileValue => value !== null);
      for (let r = 0; r < ROWS; r += 1) next[r][column] = values[r] ?? null;
    }
    historyRef.current = [...historyRef.current.slice(-9), { board: cloneBoard(board), score, currentTile, nextTile, highestBlock, totalXp }];
    const resolved = resolveMerges(next, { row: 0, col: 0 }, highestBlock, { scanWholeBoard: true });
    // Booster merges count toward tile and merge objectives, not a shot chain.
    const challengeMerges = resolved.merges;
    if (challengeMerges.length) recordChallengeMove(`${runId.current}:${++moveNumber.current}`, challengeMerges, Date.now(), false);
    setBoard(resolved.board);
    const nextScore = score + resolved.scoreGained;
    const scoreCheckpoint = getCrossedScoreCheckpoint(score, nextScore);
    setScore(nextScore);
    updateRunStats((stats) => ({ ...stats, highestTile: Math.max(stats.highestTile, ...resolved.merges.map((merge) => merge.value)) }));
    setBestScore((value) => Math.max(value, nextScore));
    const created = Math.max(highestBlock, ...resolved.merges.map((merge) => merge.value));
    setTotalXp((value) => value + calculateMergeXp(resolved.merges) + calculateMilestoneXp(highestBlock, created));
    if (created > highestBlock) {
      if (getRetiredValuesForHighest(created).length > getRetiredValuesForHighest(highestBlock).length) historyRef.current = [];
      setHighestBlock(created);
      setModalTile(created);
      const milestone = getMilestoneInfo(created);
      setMilestoneInfo(milestone);
      setModal(milestone ? 'milestone' : 'unlock');
      queueOrShowAdBreak(scoreCheckpoint, true);
      const pool = getActiveTilePool(created);
      const safeCurrent = pool.includes(currentTile) ? currentTile : spawnTile(created);
      setCurrentTile(safeCurrent);
      setNextTile(pool.includes(nextTile) ? nextTile : spawnTile(created, [safeCurrent]));
    } else {
      queueOrShowAdBreak(scoreCheckpoint);
    }
    setBoosters((counts) => ({ ...counts, hammer: counts.hammer - 1 }));
    setHammerActive(false);
  }, [board, currentTile, gameMode, hammerActive, highestBlock, nextTile, queueOrShowAdBreak, score, totalXp, spawnTile, updateRunStats]);

  const claimUnlock = useCallback((double: boolean) => {
    if (!modalTile || claimLock.current || pendingAd()) return;
    if (double) {
      try {
        claimLock.current = true;
        requestAd('milestone_double', { milestone: modalTile });
        setAdBusy(true);
      } catch {
        claimLock.current = false;
        window.dispatchEvent(new CustomEvent('merge-toast', { detail: 'Bonus collection is unavailable. You can still collect your normal reward.' }));
      }
      return;
    }
    claimLock.current = true;
    const wallet = creditReward(`milestone:${modalTile}`, REWARD_VALUES[modalTile] ?? 10);
    setGems(wallet.gems);
    setMilestoneInfo(null);
    if (!releaseQueuedAdBreak()) setModal(null);
    queueMicrotask(() => { claimLock.current = false; });
  }, [modalTile, releaseQueuedAdBreak]);

  const closeMilestone = useCallback(() => claimUnlock(false), [claimUnlock]);

  const watchForBooster = useCallback((type: BoosterType) => {
    if (pendingAd() || isShooting || isResolvingMerge || isPromotingNextTile || (modal && modal !== 'booster-refill') || tutorialStep > 0) return;
    try { requestAd('booster_refill', { booster: type }); setAdBusy(true); }
    catch { window.dispatchEvent(new CustomEvent('merge-toast', { detail: 'Bonus collection is unavailable. Please try again later.' })); }
  }, [isShooting, isResolvingMerge, isPromotingNextTile, modal, tutorialStep]);

  const buyBooster = useCallback((type: BoosterType) => {
    if (pendingAd() || isShooting || isResolvingMerge || isPromotingNextTile || (modal && modal !== 'booster-refill') || tutorialStep > 0) return;
    const wallet = purchaseBoosters(type);
    if (!wallet) return;
    setGems(wallet.gems);
    setBoosters(wallet.boosters);
  }, [isShooting, isResolvingMerge, isPromotingNextTile, modal, tutorialStep]);

  const purchaseShopItem = useCallback((item: BoosterType | 'bundle') => {
    if (pendingAd()) return false;
    const wallet = purchaseBoosters(item);
    if (!wallet) return false;
    setGems(wallet.gems); setBoosters(wallet.boosters);
    return true;
  }, []);

  const collectDailyGift = useCallback((double = false) => {
    if (pendingAd()) return false;
    const result = collectDaily();
    if (!result) return false;
    setGems(result.wallet.gems); setBoosters(result.wallet.boosters);
    if (double && result.gift.gems > 0 && !result.gift.booster) {
      try { requestAd('daily_double', { dailyId: result.id, dailyIndex: result.index }); setAdBusy(true); }
      catch { window.dispatchEvent(new CustomEvent('merge-toast', { detail: 'Your daily gift was collected. Bonus collection is unavailable.' })); }
    }
    return true;
  }, []);

  const collectChallengeReward = useCallback((id: ChallengeId) => {
    if (pendingAd()) return false;
    const wallet = collectChallenge(id);
    if (!wallet) return false;
    setGems(wallet.gems);
    return true;
  }, []);

  const setBoosterOfferOpen = useCallback((open: boolean) => {
    if (pendingAd()) return;
    setHammerActive(false);
    setModal(open ? 'booster-refill' : null);
  }, []);

  const resolveCreatedAgain = useCallback((upgrade: boolean) => {
    let upgradedMilestone: MilestoneInfo | null = null;
    if (upgrade && gems >= 155 && modalTile && pendingPosition.current) {
      setGems((amount) => amount - 155);
      const upgraded = modalTile * 2;
      upgradedMilestone = getMilestoneInfo(upgraded);
      setBoard((current) => {
        const next = cloneBoard(current);
        const { row, col } = pendingPosition.current!;
        if (next[row]?.[col] === modalTile) {
          next[row][col] = upgraded;
          setHighestBlock((highest) => (upgraded > highest ? upgraded : highest));
        }
        return next;
      });
      if (upgradedMilestone && !retiredTiles.includes(upgradedMilestone.retired)) {
        // Retirement auto-updates via highestBlock; just refresh the shooter
        // tiles so neither is a value retired by crossing this milestone.
        const safeCurrent = spawnTile(upgraded, []);
        const safeNext = spawnTile(upgraded, [safeCurrent]);
        setCurrentTile(safeCurrent);
        setNextTile(safeNext);
        setMilestoneInfo(upgradedMilestone);
        setModalTile(upgradedMilestone.current);
        setModal('milestone');
        return;
      }
    }
    setModal(null);
  }, [gems, modalTile, retiredTiles, spawnTile]);

  return {
    screen, mode: gameMode, challengeId, challengeOutcome, challengeBestScore, runStats,
    challengeMovesRemaining: challengeId ? Math.max(0, getChallengeRun(challengeId).shotLimit - runStats.shots) : 0,
    dailySeedDay, dailySeedBestScore: dailySeedRecord.bestScore,
    dailySeedLongestChain: dailySeedRecord.longestChain, dailySeedRunLongestChain, dailySeedRunBestAtStart,
    dailySeedCanResume: dailyRunRef.current?.day === dailySeedDay,
    board, currentTile, nextTile, selectedColumn, score, bestScore: gameMode === 'daily-seed' ? dailySeedRecord.bestScore : bestScore, gems, highestBlock, level,
    totalXp, xpIntoLevel: levelState.xpIntoLevel, xpToNextLevel: levelState.xpToNextLevel, levelProgress: levelState.progressPercent,
    boosters, modal, modalTile, milestoneInfo, retiredTiles, tutorialStep, hammerActive, isShooting,
    isPromotingNextTile, isResolvingMerge, shotTile: shotTileValue,
    shotTargetColumn, shotTargetRow, shotDuration, mergeEvents, mergeAnimation, combo, currentGoal,
    startGame, startDailySeed, startChallengeRun, goHome, restart, shoot, selectColumn, moveSelection, pause,
    resume, useBooster, hitWithHammer, skipTutorial, closeGoal, claimUnlock, closeMilestone, resolveCreatedAgain,
    adBusy, adAvailable, adBreakScore, requestAdBreak, finishAdBreak, watchForBooster, buyBooster, setBoosterOfferOpen, purchaseShopItem, collectDailyGift, collectChallengeReward,
  };
}
