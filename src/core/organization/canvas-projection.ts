import type { CanvasCard, CanvasCardStatus } from '../beatcanvas/canvas-types';
import { displayedGroupFrame } from './group-layout';
import {
  normalizeCanvasOrganization,
  validateCanvasOrganization,
  type CanvasOrganizationDocument,
  type CanvasOrganizationFrame,
} from './canvas-organization';

export type CanvasOrganizationProjectedNode = {
  id: string;
  kind: 'card' | 'group';
  cardId?: string;
  groupId?: string;
  frame?: CanvasOrganizationFrame;
  memberCount?: number;
  resultCardId?: string | null;
  statuses?: Partial<Record<CanvasCardStatus, number>>;
};
export type CanvasOrganizationProjectedEdge = {
  id: string;
  source: string;
  target: string;
  count: number;
  references: Array<{ sourceCardId: string; targetCardId: string }>;
};
export type CanvasOrganizationProjection = {
  nodes: CanvasOrganizationProjectedNode[];
  edges: CanvasOrganizationProjectedEdge[];
  hiddenCardIds: string[];
  historyGroups: Array<{ generationCardId: string; outputCardIds: string[] }>;
};

/** Read-only graph projection: proxy endpoints never become generation inputs. */
export function projectCanvasOrganization(
  document: CanvasOrganizationDocument,
  options: { selectedGroupId?: string | null; showAllReferences?: boolean } = {}
): CanvasOrganizationProjection {
  const organization = normalizeCanvasOrganization(document.organization);
  validateCanvasOrganization(document);
  const cards = new Map(document.cards.map((card) => [card.id, card]));
  const memberGroup = new Map<string, string>();
  for (const group of Object.values(organization.groups))
    for (const id of group.memberCardIds) memberGroup.set(id, group.id);
  // Outputs remain in Takes rather than becoming media boxes in either history mode.
  // Analysis reports are visible documents in existing Canvas and remain so.
  const isVisibleOutput = (card: CanvasCard) =>
    card.kind !== 'output' ||
    card.generationSnapshot?.generationMode === 'analysis';
  const groupForCard = (cardId: string): string | undefined =>
    memberGroup.get(cardId) ??
    (cards.get(cardId)?.sourceConfigCardId
      ? memberGroup.get(cards.get(cardId)!.sourceConfigCardId!)
      : undefined);
  const endpoint = (cardId: string): string | null => {
    const card = cards.get(cardId);
    if (!card) return null;
    const groupId = groupForCard(cardId);
    if (groupId && organization.groups[groupId]?.collapsed) return groupId;
    if (isVisibleOutput(card)) return cardId;
    return card.sourceConfigCardId && cards.has(card.sourceConfigCardId)
      ? card.sourceConfigCardId
      : null;
  };
  const nodes: CanvasOrganizationProjectedNode[] = [];
  const hiddenCardIds: string[] = [];
  const statusesByGroup = new Map<
    string,
    Partial<Record<CanvasCardStatus, number>>
  >();
  for (const card of document.cards) {
    const groupId = groupForCard(card.id);
    if (groupId && (card.kind === 'generation' || card.kind === 'output')) {
      const statuses = statusesByGroup.get(groupId) ?? {};
      statuses[card.status] = (statuses[card.status] ?? 0) + 1;
      statusesByGroup.set(groupId, statuses);
    }
  }
  for (const group of Object.values(organization.groups)) {
    nodes.push({
      id: group.id,
      kind: 'group',
      groupId: group.id,
      frame: displayedGroupFrame(document, group),
      memberCount: group.memberCardIds.length,
      resultCardId: group.resultCardId,
      statuses: statusesByGroup.get(group.id) ?? {},
    });
  }
  for (const card of document.cards) {
    if (endpoint(card.id) !== card.id) hiddenCardIds.push(card.id);
    else
      nodes.push({
        id: card.id,
        kind: 'card',
        cardId: card.id,
        frame: document.frames[card.id],
      });
  }
  const edgesByPair = new Map<string, CanvasOrganizationProjectedEdge>();
  const seenReferences = new Set<string>();
  const showAll =
    options.showAllReferences ?? organization.view.referenceMode === 'all';
  for (const card of document.cards) {
    // Output history derivation is inspected in Takes, not projected as current inputs.
    if (card.kind === 'output' && !isVisibleOutput(card)) continue;
    const target = endpoint(card.id);
    if (!target) continue;
    for (const sourceCardId of card.referenceCardIds) {
      const source = endpoint(sourceCardId);
      if (!source || source === target) continue;
      const sourceGroup = groupForCard(sourceCardId);
      const targetGroup = groupForCard(card.id);
      if (
        !showAll &&
        sourceGroup !== targetGroup &&
        sourceGroup !== options.selectedGroupId &&
        targetGroup !== options.selectedGroupId
      )
        continue;
      const key = JSON.stringify([source, target]);
      let edge = edgesByPair.get(key);
      if (!edge) {
        edge = {
          id: `organization-edge:${key}`,
          source,
          target,
          count: 0,
          references: [],
        };
        edgesByPair.set(key, edge);
      }
      const referenceKey = JSON.stringify([sourceCardId, card.id]);
      if (!seenReferences.has(referenceKey)) {
        seenReferences.add(referenceKey);
        edge.count++;
        edge.references.push({ sourceCardId, targetCardId: card.id });
      }
    }
  }
  const historyByGeneration = new Map<string, string[]>();
  if (organization.view.historyMode === 'all') {
    for (const card of document.cards)
      if (card.kind === 'output') {
        const outputs = historyByGeneration.get(card.sourceConfigCardId) ?? [];
        outputs.push(card.id);
        historyByGeneration.set(card.sourceConfigCardId, outputs);
      }
  }
  return {
    nodes,
    edges: [...edgesByPair.values()],
    hiddenCardIds,
    historyGroups: [...historyByGeneration].map(
      ([generationCardId, outputCardIds]) => ({
        generationCardId,
        outputCardIds,
      })
    ),
  };
}
