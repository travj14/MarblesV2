/**
 * Audio System for Marbles Game
 * Generates 8-bit style sound effects using Web Audio API
 */
const Audio = {
    context: null,
    enabled: true,
    volume: 0.3,

    /**
     * Initialize audio context
     */
    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    /**
     * Resume audio context (needed after user interaction)
     */
    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    },

    /**
     * Play a sound effect
     */
    play(soundName) {
        if (!this.enabled) return;

        this.init();
        this.resume();

        switch (soundName) {
            case 'roll':
                this.playDiceRoll();
                break;
            case 'move':
                this.playMove();
                break;
            case 'capture':
                this.playCapture();
                break;
            case 'enter':
                this.playEnter();
                break;
            case 'home':
                this.playHome();
                break;
            case 'win':
                this.playWin();
                break;
            case 'click':
                this.playClick();
                break;
            case 'error':
                this.playError();
                break;
        }
    },

    /**
     * Create an oscillator with given parameters
     */
    createOscillator(type, frequency, duration, startTime = 0) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        gain.gain.value = this.volume;
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.start(this.context.currentTime + startTime);
        osc.stop(this.context.currentTime + startTime + duration);

        return osc;
    },

    /**
     * Dice roll sound - rapid frequency sweep
     */
    playDiceRoll() {
        const duration = 0.4;
        const steps = 8;

        for (let i = 0; i < steps; i++) {
            const freq = 200 + Math.random() * 400;
            this.createOscillator('square', freq, 0.05, i * (duration / steps));
        }
    },

    /**
     * Marble move sound - short blip
     */
    playMove() {
        this.createOscillator('square', 440, 0.08);
        this.createOscillator('square', 554, 0.08, 0.04);
    },

    /**
     * Capture sound - descending tone
     */
    playCapture() {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.3);

        gain.gain.value = this.volume;
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.start();
        osc.stop(this.context.currentTime + 0.3);
    },

    /**
     * Enter track sound - rising tone
     */
    playEnter() {
        this.createOscillator('square', 262, 0.1);
        this.createOscillator('square', 330, 0.1, 0.1);
        this.createOscillator('square', 392, 0.15, 0.2);
    },

    /**
     * Marble reaches home sound - happy ascending
     */
    playHome() {
        this.createOscillator('square', 523, 0.1);
        this.createOscillator('square', 659, 0.1, 0.1);
        this.createOscillator('square', 784, 0.15, 0.2);
        this.createOscillator('square', 1047, 0.2, 0.35);
    },

    /**
     * Victory fanfare
     */
    playWin() {
        const notes = [523, 659, 784, 1047, 784, 1047];
        const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.4];
        let time = 0;

        for (let i = 0; i < notes.length; i++) {
            this.createOscillator('square', notes[i], durations[i], time);
            time += durations[i];
        }
    },

    /**
     * UI click sound
     */
    playClick() {
        this.createOscillator('square', 800, 0.05);
    },

    /**
     * Error buzz
     */
    playError() {
        this.createOscillator('sawtooth', 100, 0.15);
        this.createOscillator('sawtooth', 80, 0.15, 0.1);
    },

    /**
     * Toggle sound on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
};
