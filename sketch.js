var source, fft, lowPass;
var player;
// center clip nullifies samples below a clip amount
var doCenterClip = false;
var centerClipThreshold = 0;
let accuracy = 0;
// normalize pre / post autocorrelation
var preNormalize = true;
var postNormalize = true;
let notes = [];

// In this case, we're using D standard tuning, adjust accordingly
let dStringOctave = ['D2','D#2','E2','F2','F#2','G2','G#2','A2','A#2','B2','C3','C#3','D3'];
let gStringOctave = ['G2','G#2','A2','A#2','B2','C3','C#3','D3','D#3','E3','F3','F#3','G3'];
let cStringOctave = ['C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3','C4'];
let fStringOctave = ['F3','F#3','G3','G#3','A3','A#3','B3','C4','C#4','D4','D#4','E4','F4'];
let aStringOctave = ['A3','A#3','B3','C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4'];
let highDStringOctave = ['D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4','C5','C#5','D5'];


function updateAccuracy(midiValue, actualValue, noteAmount) {
  expected = midiToFreq(midiValue);
  console.log("expected ", expected);
  if ((expected*0.9)<=actualValue){ //adjust to make less/more lenient with accepted pitches
    accuracy += 1/noteAmount;}
    else if (actualValue<=(expected*1.1)){
      accuracy += 1/noteAmount;
  }
  
}

function setup() {
  createCanvas(710, 400);
  source = new p5.AudioIn();
  source.start();

  lowPass = new p5.LowPass();
  lowPass.disconnect();
  source.connect(lowPass);

  fft = new p5.FFT();
  fft.setInput(lowPass);
  //console.log("C3 in midi is ",midi);
  //console.log("midi 38 is ",midiToFreq(38));
  monoSynth = new p5.MonoSynth();
  // Create object
  for (let i = 0; i<50;i++){
    notes.push(new Note(floor(random(5)),floor(random(6)),(i*60)))
  }
  //note is as follows, fret number, string, 'timing' offset
  //in this case it's just making random notes and adding them to the note array
  //but you could very easily create an array that contains the tab to a song
  //chords are not implemented but would still display correctly
}

function playSynth(expectNote) {
  userStartAudio();

  // note duration (in seconds)
  let dur = 0.7;

  // time from now (in seconds)
  let time = 0;

  // velocity (volume, from 0 to 1)
  let vel = 0.4;

  // only one note can play at a time, change when chords are implemented
  monoSynth.play(expectNote, vel, 0, dur);
}

function draw() {
  background(50, 89, 100);
  stroke(0);
  //strings
  line(0,345,width,345);
  line(0,300,width,300);
  line(0,255,width,255);
  line(0,210,width,210);
  line(0,165,width,165);
  line(0,120,width,120);
  line(80,120,80,345); //play note here
  var timeDomain = fft.waveform(1024, 'float32');
  var corrBuff = autoCorrelate(timeDomain);

  
  fill(0);
  text ('Center Clip: ' + centerClipThreshold, 20, 20); 
  freq = findFrequency(corrBuff);
  text ('Fundamental Frequency: ' + freq.toFixed(2), 20, 50); 
  text ('Accuracy: ' + accuracy.toFixed(2), 20, 70)

  for (let i = 0; i<notes.length; i++){
    notes[i].move();
    notes[i].display();
    notes[i].playSound();
  }
}
function autoCorrelate(timeDomainBuffer) {
  
  var nSamples = timeDomainBuffer.length;

  // pre-normalize the input buffer
  if (preNormalize){
    timeDomainBuffer = normalize(timeDomainBuffer);
  }

  // zero out any values below the centerClipThreshold
  if (doCenterClip) {
    timeDomainBuffer = centerClip(timeDomainBuffer);
  }

  var autoCorrBuffer = [];
  for (var lag = 0; lag < nSamples; lag++){
    var sum = 0; 
    for (var index = 0; index < nSamples-lag; index++){
      var indexLagged = index+lag;
      var sound1 = timeDomainBuffer[index];
      var sound2 = timeDomainBuffer[indexLagged];
      var product = sound1 * sound2;
      sum += product;
    }

    // average to a value between -1 and 1
    autoCorrBuffer[lag] = sum/nSamples;
  }

  // normalize the output buffer
  if (postNormalize){
    autoCorrBuffer = normalize(autoCorrBuffer); //p5 says I've used a reserved function, to which I whole heartedly disagree
  }

  return autoCorrBuffer;
}


// Find the biggest value in a buffer, set that value to 1.0,
// and scale every other value by the same amount.
function normalize(buffer) {
  var biggestVal = 0;
  var nSamples = buffer.length;
  for (var index = 0; index < nSamples; index++){
    if (abs(buffer[index]) > biggestVal){
      biggestVal = abs(buffer[index]);
    }
  }
  for (var index = 0; index < nSamples; index++){

    // divide each sample of the buffer by the biggest val
    buffer[index] /= biggestVal;
  }
  return buffer;
}

// Accepts a buffer of samples, and sets any samples whose
// amplitude is below the centerClipThreshold to zero.
// This factors them out of the autocorrelation.
function centerClip(buffer) {
  var nSamples = buffer.length;

  // center clip removes any samples whose abs is less than centerClipThreshold
  centerClipThreshold = map(mouseY, 0, height, 0,1); 

  if (centerClipThreshold > 0.0) {
    for (var i = 0; i < nSamples; i++) {
      var val = buffer[i];
      buffer[i] = (Math.abs(val) > centerClipThreshold) ? val : 0;
    }
  }
  return buffer;
}

// Calculate the fundamental frequency of a buffer
// by finding the peaks, and counting the distance
// between peaks in samples, and converting that
// number of samples to a frequency value.
function findFrequency(autocorr) {

  var nSamples = autocorr.length;
  var valOfLargestPeakSoFar = 0;
  var indexOfLargestPeakSoFar = -1;

  for (var index = 1; index < nSamples; index++){
    var valL = autocorr[index-1];
    var valC = autocorr[index];
    var valR = autocorr[index+1];

    var bIsPeak = ((valL < valC) && (valR < valC));
    if (bIsPeak){
      if (valC > valOfLargestPeakSoFar){
        valOfLargestPeakSoFar = valC;
        indexOfLargestPeakSoFar = index;
      }
    }
  }
  
  var distanceToNextLargestPeak = indexOfLargestPeakSoFar - 0;

  // convert sample count to frequency
  var fundamentalFrequency = sampleRate() / distanceToNextLargestPeak;
  return fundamentalFrequency;
}

// Note Class
class Note {
  constructor(cFret,cString,cOffset) {
    this.x = 700+cOffset;
    this.fret = cFret;
    this.y = (100+(45*cString));
    this.diameter = 40;
    this.speed = 1;
  }

  move() {
    this.x -= this.speed;
  }

  display() {
    fill(0);
    stroke(0);
    rect(this.x, this.y, this.diameter, this.diameter);
    fill(0);
    textSize(20);
    fill(255);
    stroke(255);
    textStyle(BOLD);
    text(this.fret,this.x+15,this.y+25); //text will be the fret number
  }
  
  playSound(){
    if(this.y == 325){ //D string begin
      if(this.x == 100){
        playSynth(dStringOctave[this.fret]);
        console.log(this.fret)
        console.log("sound should be playing");
        updateAccuracy((38+this.fret), freq, 50) //adjust for length of array later

        }
      }
    if(this.y == 280){ //G string begin
      if(this.x == 100){
        playSynth(gStringOctave[this.fret]);
        console.log("sound should be playing");
        updateAccuracy((43+this.fret), freq, 50)
        }
      } 
    if(this.y == 235){ //C string begin
      if(this.x == 100){
        playSynth(cStringOctave[this.fret]);
        console.log("sound should be playing");
        updateAccuracy((48+this.fret), freq, 50)
      }
    }
    if(this.y == 190){ //F string begin
      if(this.x == 100){
        playSynth(fStringOctave[this.fret]);
        console.log("sound should be playing");
        updateAccuracy((53+this.fret), freq, 50)
      }
    }
    if(this.y == 145){ //A string begin
      if(this.x == 100){
        playSynth(aStringOctave[this.fret]);
        console.log("sound should be playing");
        updateAccuracy((57+this.fret), freq, 50)
      }
      }
    if(this.y == 100){ //D string begin
      if(this.x == 100){
        playSynth(highDStringOctave[this.fret]);
        console.log("sound should be playing");
        updateAccuracy((62+this.fret), freq, 50)
      }
      } //D string end
    }
    
}

