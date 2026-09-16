export class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drawing = false;
    this.empty = true;
    this.last = null;
    this._lastImage = null;
    this._sized = false;
    this._resize();
    this._bind();
    window.addEventListener('resize', () => this._resize(true));
    if ('ResizeObserver' in window) {
      this._observer = new ResizeObserver(() => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this._resize(true);
        }
      });
      this._observer.observe(this.canvas);
    }
  }

  _resize(preserve) {
    const canvas = this.canvas;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (this._sized && Math.round(canvas.width) === Math.round(rect.width * ratio) && Math.round(canvas.height) === Math.round(rect.height * ratio)) {
      return;
    }
    this._sized = true;
    let prevData = null;
    if (preserve && canvas.width && canvas.height && !this.empty) {
      prevData = this._lastImage || canvas.toDataURL();
    }
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    this.ctx.scale(ratio, ratio);
    this.ctx.lineWidth = 2.4;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#0b1c3a';
    if (prevData) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
        this._lastImage = prevData;
      };
      img.src = prevData;
    }
  }

  _pos(evt) {
    const rect = this.canvas.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  _bind() {
    const start = (e) => {
      e.preventDefault();
      this.drawing = true;
      this.last = this._pos(e);
    };
    const move = (e) => {
      if (!this.drawing) return;
      e.preventDefault();
      const p = this._pos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(this.last.x, this.last.y);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
      this.last = p;
      this.empty = false;
    };
    const end = () => { this.drawing = false; };

    this.canvas.addEventListener('pointerdown', start);
    this.canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', end);
  }

  clear() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.empty = true;
  }

  isEmpty() {
    return this.empty;
  }

  async loadFromBlob(blob) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    this._lastImage = dataUrl;
    this.empty = false;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = () => {
          this.ctx.clearRect(0, 0, rect.width, rect.height);
          this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
          resolve();
        };
        img.src = dataUrl;
      });
    }
  }

  toBlob() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
  }

  // Call after the canvas becomes visible (e.g. its accordion just opened) — while
  // hidden (display:none) it has no layout box, so the initial sizing is skipped.
  forceResize() {
    this._sized = false;
    this._resize(true);
  }
}
