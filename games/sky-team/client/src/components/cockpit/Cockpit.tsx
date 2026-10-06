import type { PlayerView } from '@sky/rules';
import type { ComponentType } from 'react';
import { cn } from '@platform/ui/utils';
import { AREA, desktopGrid, HALF, shownSections, SPAN, type Section } from './layout';
import { AlarmsPanel, InternPanel, KerosenePanel, WindPanel } from './ModulePanels';
import {
  BrakesPanel,
  ConcentrationPanel,
  FlapsPanel,
  GearPanel,
  InstrumentPanel,
  RadioPanel,
} from './panels';

const PANELS: Record<Section, ComponentType<{ view: PlayerView }>> = {
  wind: WindPanel,
  instrument: InstrumentPanel,
  radio: RadioPanel,
  gear: GearPanel,
  flaps: FlapsPanel,
  brakes: BrakesPanel,
  concentration: ConcentrationPanel,
  kerosene: KerosenePanel,
  intern: InternPanel,
  alarms: AlarmsPanel,
};

/** The control panel: the panels in play, in this seat's order (a fixed grid on desktop). */
export function Cockpit({ view }: { view: PlayerView }) {
  const shown = shownSections(view);
  return (
    <div className="@container">
      <div
        className="cockpit-grid grid grid-cols-[auto_minmax(0,1fr)] gap-2 desktop:gap-3"
        style={desktopGrid(shown)}
      >
        {shown.map((id) => {
          const SectionPanel = PANELS[id];
          return (
            <div key={id} className={cn(HALF[id] ?? SPAN, AREA[id])}>
              <SectionPanel view={view} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
