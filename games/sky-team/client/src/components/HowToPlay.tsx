// A button that opens the base game's rules as a slider, one step per slide, in the rulebook's
// order (st_rules01_en_06jun2023.pdf). Each slide shows a screenshot of the game with the part
// to look at boxed (assets/how-to-play/<language>/<step>.png).
import { ChevronLeft, ChevronRight, CircleHelp } from 'lucide-react';
import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@platform/ui/components/button';
import { cn } from '@platform/ui/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@platform/ui/components/dialog';

/** Each step's text is `howToPlay.steps.<id>.title` / `.body`; its picture is `<language>/<id>.png`. */
const STEPS = [
  'goal',
  'rounds',
  'strategy',
  'reroll',
  'placement',
  'mandatory',
  'axis',
  'engines',
  'collision',
  'radio',
  'landingGear',
  'flaps',
  'concentration',
  'brakes',
  'endOfRound',
  'finalRound',
  'landing',
] as const;

const IMAGES = import.meta.glob<string>('../assets/how-to-play/*/*.png', {
  eager: true,
  import: 'default',
});

/** The step's screenshot in the player's language (English where a language has none). */
const imageOf = (language: string, id: string) =>
  IMAGES[`../assets/how-to-play/${language}/${id}.png`] ??
  IMAGES[`../assets/how-to-play/en/${id}.png`];

/** A phone on its side: wide, not tall. The modal takes the width and the slide goes side by side;
 * under 22rem tall (an iPhone SE on its side) the padding and gaps shrink too. */
const SHORT =
  '[@media(max-height:32rem)]:max-w-[calc(100%-2rem)]! [@media(max-height:22rem)]:gap-2 [@media(max-height:22rem)]:p-3';

/** How far a swipe must travel, in pixels, to change the slide. */
const SWIPE_PX = 40;

export function HowToPlay() {
  const { t } = useTranslation('sky-team');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-11">
          <CircleHelp /> {t('howToPlay.open')}
        </Button>
      </DialogTrigger>
      {/* Flex, not the default grid: a grid column would grow to the width of all the slides. */}
      <DialogContent
        className={cn(
          'flex h-[min(90dvh,48rem)] flex-col gap-3 tablet:max-w-xl!',
          'desktop:h-[min(80dvh,36rem)] desktop:max-w-4xl!',
          SHORT,
        )}
      >
        <DialogHeader>
          <DialogTitle>{t('howToPlay.title')}</DialogTitle>
          {/* Read by screen readers only where the room is needed for the slide (phones). */}
          <DialogDescription className="max-desktop:sr-only [@media(max-height:32rem)]:sr-only">
            {t('howToPlay.intro')}
          </DialogDescription>
        </DialogHeader>
        {/* Inside the content, so closing the dialog brings it back to the first step. */}
        <Steps />
      </DialogContent>
    </Dialog>
  );
}

// The slides with Previous / Next, swipe and arrow keys
function Steps() {
  const { t, i18n } = useTranslation('sky-team');
  const [step, setStep] = useState(0);
  const [swipeFrom, setSwipeFrom] = useState<number | null>(null);
  const last = STEPS.length - 1;

  // Move by one slide, staying within the steps
  const go = (delta: number) => setStep((s) => Math.min(last, Math.max(0, s + delta)));

  function handlePointerUp(e: PointerEvent) {
    if (swipeFrom === null) return;
    const dx = e.clientX - swipeFrom;
    setSwipeFrom(null);
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 [@media(max-height:22rem)]:gap-2">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t('howToPlay.title')}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => setSwipeFrom(e.clientX)}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setSwipeFrom(null)}
        className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className="flex min-h-0 flex-1 transition-transform duration-300 motion-reduce:transition-none"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {STEPS.map((id, i) => {
            const title = t(`howToPlay.steps.${id}.title`);
            return (
              <section
                key={id}
                role="group"
                aria-roledescription="slide"
                aria-label={t('howToPlay.stepOf', { step: i + 1, total: STEPS.length })}
                inert={i !== step}
                className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto px-0.5 [scrollbar-width:none] desktop:flex-row desktop:gap-5 [&::-webkit-scrollbar]:hidden [@media(max-height:32rem)]:flex-row [@media(max-height:32rem)]:gap-3"
              >
                {/* The picture takes the room the text leaves, so the text is always shown whole.
                    Only this slide and its neighbours load theirs. */}
                <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                  {Math.abs(i - step) <= 1 && (
                    <img
                      src={imageOf(i18n.language, id)}
                      alt={t('howToPlay.imageAlt', { title })}
                      draggable={false}
                      className="max-h-full max-w-full rounded-lg border bg-white object-contain"
                    />
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 desktop:w-2/5 desktop:justify-center [@media(max-height:32rem)]:w-[55%] [@media(max-height:32rem)]:justify-center">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-[13px] leading-5 whitespace-pre-line text-muted-foreground tablet:text-sm [@media(max-height:22rem)]:text-[11px] [@media(max-height:22rem)]:leading-[14px] [@media(min-height:22rem)_and_(max-height:32rem)]:text-xs [@media(min-height:22rem)_and_(max-height:32rem)]:leading-4">
                    {t(`howToPlay.steps.${id}.body`)}
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {/* Under 373px wide the Previous / Next words give way to their arrows (the French ones need the room). */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Button variant="outline" className="h-11" disabled={step === 0} onClick={() => go(-1)}>
          <ChevronLeft /> <span className="max-[373px]:sr-only">{t('howToPlay.previous')}</span>
        </Button>
        <span
          className="text-xs whitespace-nowrap text-muted-foreground tabular-nums tablet:text-sm"
          aria-live="polite"
        >
          {t('howToPlay.stepOf', { step: step + 1, total: STEPS.length })}
        </span>
        <Button variant="outline" className="h-11" disabled={step === last} onClick={() => go(1)}>
          <span className="max-[373px]:sr-only">{t('howToPlay.next')}</span> <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
