import { useApp, type Layer } from './context';
import { ConfirmSheet } from './sheets/ConfirmSheet';
import { ExpenseSheet } from './sheets/ExpenseSheet';
import { GroupSettingsSheet } from './sheets/GroupSettingsSheet';
import { ImportSheet } from './sheets/ImportSheet';
import { IncomingSheet } from './sheets/IncomingSheet';
import { NewGroupSheet } from './sheets/NewGroupSheet';
import { RecurringSheet } from './sheets/RecurringSheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { ShareSheet } from './sheets/ShareSheet';
import { WhoAmISheet } from './sheets/WhoAmISheet';

export interface SheetProps {
  active: boolean;
  onClose: () => void;
}

/** Pinta la hoja que corresponde a cada capa de la pila. */
export function LayerView({ layer, active }: { layer: Layer; active: boolean }) {
  const { pop, groups } = useApp();
  const onClose = () => pop();
  const p = { active, onClose };
  const groupOf = (id: string) => groups.find((g) => g.id === id);
  switch (layer.t) {
    case 'group':
      return null;
    case 'newGroup':
      return <NewGroupSheet {...p} />;
    case 'settings':
      return <SettingsSheet {...p} />;
    case 'import':
      return <ImportSheet {...p} restore={layer.restore ?? false} />;
    case 'incoming':
      return <IncomingSheet {...p} source={layer.source} />;
    case 'confirm':
      return <ConfirmSheet {...p} spec={layer} />;
    default: {
      const group = groupOf(layer.groupId);
      if (!group) return null;
      switch (layer.t) {
        case 'expense':
          return <ExpenseSheet {...p} group={group} expenseId={layer.expenseId} kind={layer.kind} />;
        case 'recurring':
          return <RecurringSheet {...p} group={group} recurringId={layer.recurringId} />;
        case 'groupSettings':
          return <GroupSettingsSheet {...p} group={group} />;
        case 'whoami':
          return <WhoAmISheet {...p} group={group} />;
        case 'share':
          return <ShareSheet {...p} group={group} />;
      }
    }
  }
}
