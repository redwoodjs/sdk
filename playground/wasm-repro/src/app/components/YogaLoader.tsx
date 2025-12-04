import yoga, { Node } from 'yoga-wasm-web';

const YogaDisplay = ({ loaded }: { loaded: boolean }) => {
  return (
    <div id="yoga-status">
      {loaded
        ? 'Yoga WASM module loaded successfully.'
        : 'Failed to load Yoga WASM module.'}
    </div>
  );
};

export function YogaLoader() {
  let loaded = false;
  try {
    const node = Node.create();
    node.free();
    loaded = true;
  } catch (e) {
    console.error(e);
  }

  return <YogaDisplay loaded={loaded} />;
}
