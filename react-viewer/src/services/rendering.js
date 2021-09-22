
export function createCanvas() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext("2d");
  return {canvas, context};
}

export function freeCanvas({canvas}) {
  canvas.width = 0;
  canvas.height = 0;
}
