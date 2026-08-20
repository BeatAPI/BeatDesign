type CardConnectorCallback = (
  shapeId: string,
  side: 'input' | 'output'
) => void;

let activeCallback: CardConnectorCallback | null = null;

export function registerCardConnectorCallback(
  cb: CardConnectorCallback | null
) {
  activeCallback = cb;
}

export function fireCardConnector(shapeId: string, side: 'input' | 'output') {
  activeCallback?.(shapeId, side);
}
