import type { AudioFeatures7D, RecommendedTrack, Track } from '../types/music.ts';

export const CLUSTER_META: Record<
  number,
  { label: string; fallbackCover: string; accentHex: string }
> = {
  1: {
    label: 'Velvet Nocturne R&B',
    fallbackCover: '/src/assets/images/album_velvet_rnb_1794915756582.jpg',
    accentHex: '#1DB954',
  },
  2: {
    label: 'High-Energy Synth',
    fallbackCover: '/src/assets/images/album_synth_night_1794915755115.jpg',
    accentHex: '#1ED760',
  },
  3: {
    label: 'Kinetic Nu-Disco & Pop',
    fallbackCover: '/src/assets/images/album_groove_pop_1794915757412.jpg',
    accentHex: '#1DB954',
  },
  4: {
    label: 'Deep Cosmic Electronic',
    fallbackCover: '/src/assets/images/album_cosmic_electronic_1794915755233.jpg',
    accentHex: '#10B981',
  },
  5: {
    label: 'Atmospheric Indie & Alt',
    fallbackCover: '/src/assets/images/album_indie_acoustic_1794915756277.jpg',
    accentHex: '#34D399',
  },
};

export function normalizeFeatureVector(f: AudioFeatures7D): number[] {
  const normTempo = Math.min(1, Math.max(0, (f.bpm - 60) / 130));
  return [
    normTempo,
    f.energy,
    f.danceability,
    f.valence,
    f.acousticness,
    f.instrumentalness,
    f.speechiness,
  ];
}

export function computeCosineSimilarity(a: AudioFeatures7D, b: AudioFeatures7D): number {
  const va = normalizeFeatureVector(a);
  const vb = normalizeFeatureVector(b);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    magA += va[i] * va[i];
    magB += vb[i] * vb[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function findDominantTraitMatch(a: AudioFeatures7D, b: AudioFeatures7D): string {
  const va = normalizeFeatureVector(a);
  const vb = normalizeFeatureVector(b);
  const labels = [
    'Tempo Lock',
    'Energy Profile',
    'Groove Cadence',
    'Mood Valence',
    'Timbre Texture',
    'Instrumental Balance',
    'Vocal Presence',
  ];
  let bestIdx = 0;
  let smallestDiff = Infinity;
  for (let i = 0; i < va.length; i++) {
    const diff = Math.abs(va[i] - vb[i]);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestIdx = i;
    }
  }
  return labels[bestIdx];
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRand(seed: number, step: number): number {
  const x = Math.sin(seed + step * 97.13) * 10000;
  return x - Math.floor(x);
}

/**
 * Detect primary track language from script, genre, and linguistic markers.
 */
export function detectTrackLanguage(
  title: string,
  artist: string,
  genre = '',
  album = ''
): string {
  const combined = `${title} ${artist} ${album}`.trim();
  const lower = combined.toLowerCase();
  const g = genre.toLowerCase();

  // 1. Non-Latin script detection
  if (/[\u0D00-\u0D7F]/.test(combined)) return 'Malayalam';
  if (/[\u0B80-\u0BFF]/.test(combined)) return 'Tamil';
  if (/[\u0C00-\u0C7F]/.test(combined)) return 'Telugu';
  if (/[\u0C80-\u0CFF]/.test(combined)) return 'Kannada';
  if (/[\u0A00-\u0A7F]/.test(combined)) return 'Punjabi';
  if (/[\u0980-\u09FF]/.test(combined)) {
    return /\b(assamese|axomiya|bihu|zubeen|bhupen)\b/i.test(lower) ? 'Assamese' : 'Bengali';
  }
  if (/[\u0A80-\u0AFF]/.test(combined)) return 'Gujarati';
  if (/[\u0B00-\u0B7F]/.test(combined)) return 'Odia';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(combined)) return 'Japanese';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(combined)) return 'Korean';
  if (/[\u4E00-\u9FFF]/.test(combined)) return 'Chinese';
  if (/[\u0900-\u097F]/.test(combined)) {
    return /\b(marathi|lavani|ajay-atul|sairat|zingaat)\b/i.test(lower) ? 'Marathi' : 'Hindi';
  }
  if (/[\u0600-\u06FF]/.test(combined)) {
    return /\b(urdu|qawwali|ghazal|coke studio|pasoori|rahat|nusrat)\b/i.test(lower)
      ? 'Urdu'
      : 'Arabic';
  }
  if (/[\u0400-\u04FF]/.test(combined)) return 'Russian';
  if (/[\u0E00-\u0E7F]/.test(combined)) return 'Thai';
  if (/[\u0370-\u03FF]/.test(combined)) return 'Greek';
  if (/[\u0590-\u05FF]/.test(combined)) return 'Hebrew';

  // 2. Explicit regional genre or title/album language tags (e.g. "Baasha - Tamil", "[Telugu]", "(Malayalam)")
  const genreOrBracketTag = `${g} ${lower}`;
  if (g.includes('malayalam') || /\bmalayalam\b/i.test(combined)) return 'Malayalam';
  if (g.includes('tamil') || /\btamil\b/i.test(combined) || g.includes('kollywood')) return 'Tamil';
  if (g.includes('telugu') || /\btelugu\b/i.test(combined) || g.includes('tollywood')) return 'Telugu';
  if (g.includes('kannada') || /\bkannada\b/i.test(combined) || g.includes('sandalwood')) return 'Kannada';
  if (g.includes('punjabi') || /\bpunjabi\b/i.test(combined) || g.includes('bhangra')) return 'Punjabi';
  if (g.includes('marathi') || /\bmarathi\b/i.test(combined)) return 'Marathi';
  if (g.includes('bengali') || g.includes('bangla') || g.includes('rabindra') || /\b(bengali|bangla)\b/i.test(combined)) return 'Bengali';
  if (g.includes('gujarati') || g.includes('garba') || /\bgujarati\b/i.test(combined)) return 'Gujarati';
  if (g.includes('bhojpuri') || /\bbhojpuri\b/i.test(combined)) return 'Bhojpuri';
  if (g.includes('odia') || g.includes('oriya') || /\b(odia|oriya)\b/i.test(combined)) return 'Odia';
  if (g.includes('assamese') || g.includes('axomiya') || /\b(assamese|axomiya)\b/i.test(combined)) return 'Assamese';
  if (g.includes('haryanvi') || /\bharyanvi\b/i.test(combined)) return 'Haryanvi';
  if (g.includes('urdu') || g.includes('qawwali') || g.includes('ghazal') || /\burdu\b/i.test(combined)) return 'Urdu';
  if (g.includes('j-pop') || g.includes('enka') || g.includes('anime')) return 'Japanese';
  if (g.includes('k-pop')) return 'Korean';
  if (g.includes('mandopop') || g.includes('cantopop')) return 'Chinese';
  if (g.includes('turkish')) return 'Turkish';
  if (g.includes('indonesian') || g.includes('dangdut') || g.includes('indo pop')) return 'Indonesian';
  if (g.includes('vietnamese') || g.includes('v-pop')) return 'Vietnamese';
  if (g.includes('opm') || g.includes('pinoy') || g.includes('tagalog')) return 'Tagalog';
  if (g.includes('polish')) return 'Polish';

  // 3. Language-specific composers, lyricists, films & romanized cues (checked BEFORE pan-South-Indian playback singers)
  if (
    /\b(sushin shyam|dabzee|vinayak sasikumar|vineeth sreenivasan|shaan rahman|thaikkudam bridge|rex vijayan|avial|govind vasantha|gopi sundar|deepak dev|ouseppachan|m\.?\s*jayachandran|alphons joseph|hesham abdul wahab|jakes bejoy|prashant pillai|bijibal|job kurian|sithara krishnakumar|muhsin parari|baby jean|vedan|fejo|street academics|neeraj madhav|vishnu vijay|kailas menon|rahul raj|stephen devassy|ramesh narayan|ankit menon|dawn vincent|christo xavier|justin varghese|yakzan gary pereira|neha nair)\b/i.test(
      lower
    ) ||
    /\b(kerala|keralam|kochi|malabar|aavesham|premam|manjummel boys|hridayam|kumbalangi|bangalore days|ustad hotel|premalu|romancham|thallumaala|velipadinte|love action drama|minnal murali|bheeshma parvam|bramayugam|malare|jimikki|entammede|kudukku|kuthanthram|armadham|darshana|pavizha mazha|parayuvaan|cherathukal|neelaakasham|munthirivallikal|navarasam|hemanthamen|mandaarame|manikya malaraya|chundari penne|oru adaar love|raavu mayave|aethu kari raavilum|puthiyoru lokam|etho mazhayil|ee mizhikalin|thallendammaava|jaalakaari|chempoove|devadoothar|karimizhi|jeevamshamayi|aradhike|thoomanjin|mazha|nilave|nilavu|puzha|ente|entho|njan|ninne|ninte)\b/i.test(
      lower
    )
  ) {
    return 'Malayalam';
  }

  if (
    /\b(diljit dosanjh|ap dhillon|karan aujla|sidhu moose wala|shubh|guru randhawa|harrdy sandhu|ammy virk|gippy grewal|babbu maan|gurdas maan|satinder sartaj|sartaaj|nimrat khaira|sunanda sharma|jasmine sandlas|b praak|jassie gill|jassi gill|parmish verma|mankirt aulakh|amrinder gill|garry sandhu|sharry maan|bohemia|ikky|talwiinder|prem dhillon|arjan dhillon|navaan sandhu|cheema y|gurinder gill|shinda kahlon)\b/i.test(
      lower
    ) ||
    /\b(bhangra|jatt|jatti|gabru|patiala|ludhiana|chandigarh|brown munde|moosetape|moonchild era|tauba tauba|kinna chir|laung laachi|high rated gabru|sohneya|sohniye|kudi|munda|munde|mitran|sardarni|pind)\b/i.test(
      lower
    )
  ) {
    return 'Punjabi';
  }

  if (
    /\b(ajay gogavale|atul gogavale|ajay-atul|ajay atul|avadhoot gupte|kaushal inamdar|salil kulkarni|sandeep khare|vaishali samant|bela shende|mugdha karhade|swapnil bandodkar|rohit raut|arya ambekar|amitraj|nilesh moharir|aditya patkar)\b/i.test(
      lower
    ) ||
    /\b(lavani|sairat|zingaat|yad lagla|apsara aali|natrang|wajle ki bara|lai bhaari|fandry|duniyadari|katyar|dagdi chawl|mulshi pattern|deva shree ganesha|malhari|maharashtra|majha|tujha|tujhya|majhya|manacha)\b/i.test(
      lower
    )
  ) {
    return 'Marathi';
  }

  if (
    /\b(anupam roy|rupam islam|fossils|nachiketa|anjan dutt|kabir suman|iman chakrabarti|iman chakraborty|lagnajita|somlata|shayan chowdhury arnob|nagar baul|artcell|tahsan|habib wahid|pritom hasan|indradeep dasgupta|jeeth gannguli|jeet gannguli|debojyoti mishra|joy sarkar|chandrabindoo|moheener ghoraguli|minar rahman)\b/i.test(
      lower
    ) ||
    /\b(rabindra sangeet|kolkata|dhaka|praktan|baishe srabon|bhalobaso|bhalobasho|bhalobashi|valobashi|tumi|aami|amar|tomar|pakhi|srabon|ekla cholo|preme pora baron|tapur tupur|ek boishakhe)\b/i.test(
      lower
    )
  ) {
    return 'Bengali';
  }

  if (
    /\b(aditya gadhvi|kirtidan gadhvi|kinjal dave|geeta rabari|osman mir|jignesh kaviraj|parthiv gohil|bhoomi trivedi|aishwarya majmudar|jigardan gadhavi|falguni pathak)\b/i.test(
      lower
    ) ||
    /\b(garba|dandiya|khalasi|char bangdi|mor bani thangat|radha ne shyam|chogada|kutch|ahmedabad|navratri|rangtaali|dakla|vhalam|chandaliyo)\b/i.test(
      lower
    )
  ) {
    return 'Gujarati';
  }

  if (
    /\b(pawan singh|khesari lal yadav|dinesh lal yadav|nirahua|manoj tiwari|ravi kishan|akanksha dubey|shilpi raj)\b/i.test(
      lower
    ) ||
    /\b(lollipop lagelu|chhath)\b/i.test(lower)
  ) {
    return 'Bhojpuri';
  }

  if (
    /\b(zubeen garg|bhupen hazarika|papon)\b/i.test(lower) &&
    /\b(bihu|guwahati|mayabini)\b/i.test(lower)
  ) {
    return 'Assamese';
  }

  if (
    /\b(humane sagar|aseema panda|kuldeep pattanaik)\b/i.test(lower) ||
    /\b(odisha|cuttack|bhubaneswar)\b/i.test(lower)
  ) {
    return 'Odia';
  }

  if (
    /\b(sapna choudhary|masoom sharma|khasaa aala chahar|raju punjabi|gulzaar chhaniwala)\b/i.test(
      lower
    ) ||
    /\b(52 gaj ka daman)\b/i.test(lower)
  ) {
    return 'Haryanvi';
  }

  if (
    /\b(devi sri prasad|thaman s|s\.?\s*thaman|s\.?\s*s\.?\s*thaman|m\.?\s*m\.?\s*keeravani|mm keeravani|keeravani|mani sharma|mickey j meyer|anup rubens|bheems ceciroleo|ram miriyala|mangli|rahul sipligunj|kaala bhairava|vivek sagar|chaitan bharadwaj)\b/i.test(
      lower
    ) ||
    /\b(naatu naatu|rrr|pushpa|srivalli|oo antava|saami saami|baahubali|ala vaikunthapurramuloo|butta bomma|ramuloo ramulaa|samajavaragamana|magadheera|arjun reddy|geetha govindam|inkem inkem|rangasthalam|devara|salaar|guntur kaaram|kurchi madathapetti|sita ramam|hi nanna|hyderabad|manasu|nuvvu|nenu|bomma)\b/i.test(
      lower
    )
  ) {
    return 'Telugu';
  }

  if (
    /\b(vijay prakash|sanjith hegde|chandan shetty|vasuki vaibhav|ajaneesh loknath|ravi basrur|charan raj|hamsalekha|mano murthy|v\.?\s*harikrishna|arjun janya|raghu dixit)\b/i.test(
      lower
    ) ||
    /\b(kantara|varaha roopam|kgf|mungaru male|anisuthide|belageddu|kirik party|tagaru|sapta sagaradaache|raajakumara|charlie 777|galipata|bengaluru|karunadu|preethi|hudugi)\b/i.test(
      lower
    )
  ) {
    return 'Kannada';
  }

  if (
    /\b(anirudh ravichander|yuvan shankar raja|ilayaraja|ilaiyaraaja|harris jayaraj|santhosh narayanan|gv prakash|g\.?\s*v\.?\s*prakash|d\.?\s*imman|vijay antony|hiphop tamizha|sean roldan|pradeep kumar|sai abhyankkar|vivek-mervin|leon james|darbuka siva|ghibran|sam c\.?\s*s\.?|vairamuthu|na\.?\s*muthukumar|thamarai|kabilan|sid sriram|dhanush)\b/i.test(
      lower
    ) ||
    (/\bdeva\b/i.test(lower) &&
      (g.includes('soundtrack') ||
        g.includes('indian') ||
        g.includes('pop') ||
        /\b(s\.?\s*p\.?\s*balasubrahmanyam|vairamuthu|yesudas|chithra|swarnalatha|baasha|baashha|annamalai|muthu|padayappa)\b/i.test(
          lower
        ))) ||
    /\b(tamizh|kolaveri|vaathi|vikram|kaithi|jailer|beast|mersal|theri|bigil|kaththi|petta|kabali|enthiran|alaipayuthey|ponniyin selvan|soorarai pottru|asuran|vada chennai|rowdy baby|arabic kuthu|hukum|kaavaalaa|naa ready|munbe vaa|vaseegara|ennodu nee irundhaal|nenjukkul|kadhal|kadhale|azhagiye|maruvaarthai|thalapathy|chennai|kuthu|uyire|baasha|baashha|paru|paaru|autokaaran|autokaran|thanga magan|azhagu|raamaiya|padayappa|annamalai)\b/i.test(
      lower
    )
  ) {
    return 'Tamil';
  }

  if (
    /\b(nusrat fateh ali khan|rahat fateh ali khan|abida parveen|mehdi hassan|ghulam ali|farida khanum|ali sethi|kaifi khalil|hasan raheem|young stunners|talha anjum|talhah yunus)\b/i.test(
      lower
    ) ||
    /\b(pasoori|kahani suno|coke studio pakistan|qawwali|ghazal)\b/i.test(lower)
  ) {
    return 'Urdu';
  }

  // Fallback for pan-South-Indian playback singers when no Tamil/Telugu/Kannada/Hindi composer matched above
  if (
    !g.includes('bollywood') &&
    !g.includes('hindi') &&
    /\b(vijay yesudas|k\.?\s*j\.?\s*yesudas|k\.?\s*s\.?\s*chithra|sujatha mohan|m\.?\s*g\.?\s*sreekumar|ks harisankar|madhu balakrishnan|gayatri asokan|jyotsna radhakrishnan|vidhu prathap|najim arshad)\b/i.test(
      lower
    )
  ) {
    return 'Malayalam';
  }

  if (
    g.includes('bollywood') ||
    g.includes('hindi') ||
    g.includes('indian') ||
    g.includes('filmi') ||
    genreOrBracketTag.includes('(hindi)') ||
    genreOrBracketTag.includes('[hindi]')
  ) {
    return 'Hindi';
  }
  if (
    g.includes('latin') ||
    g.includes('reggaeton') ||
    g.includes('urbano') ||
    g.includes('mexicana') ||
    g.includes('salsa') ||
    g.includes('bachata') ||
    g.includes('español')
  ) {
    return 'Spanish';
  }
  if (g.includes('mpb') || g.includes('sertanejo') || g.includes('bossa nova') || g.includes('brazilian')) {
    return 'Portuguese';
  }
  if (g.includes('french') || g.includes('chanson')) return 'French';
  if (g.includes('german') || g.includes('schlager')) return 'German';
  if (g.includes('italian')) return 'Italian';
  if (g.includes('arabic')) return 'Arabic';

  // 4. Global & Romanized / Diacritic Cues
  if (/[ăâđêôơư]/i.test(lower) || /\b(sơn tùng|mỹ tâm|hoàng thùy linh|đen vâu|bích phương)\b/i.test(lower)) {
    return 'Vietnamese';
  }
  if (/[ğış]/i.test(lower) || /\b(tarkan|sezen aksu|mabel matiz|ezhel|mor ve ötesi|simge|aşk|sevgi|gece|kalp)\b/i.test(lower)) {
    return 'Turkish';
  }
  if (/[ąćęłńóśźż]/i.test(lower) || /\b(dawid podsiadło|sanah|taco hemingway|miłość|serce|noc)\b/i.test(lower)) {
    return 'Polish';
  }
  if (/\b(tulus|nadin amizah|pamungkas|hindia|mahalini|tiara andini|sheila on 7|dewa 19|rizky febian|siti nurhaliza|cinta|rindumu|kekasih|lagu|hati)\b/i.test(lower)) {
    return 'Indonesian';
  }
  if (/\b(ben&ben|sb19|moira dela torre|zack tabudlo|eraserheads|parokya ni edgar|up dharma down|bini|mahal|ikaw|tadhana|aking|sinta)\b/i.test(lower)) {
    return 'Tagalog';
  }
  if (/[ñ¿¡]/.test(lower) || /\b(corazón|amor|noche|canción|contigo|conmigo|siempre|quiero|pero|para|como|estoy|eres|beso|fuego|cielo|vida|sola|solo|tú|mí|tití|preguntó)\b/i.test(lower)) {
    return 'Spanish';
  }
  if (/[ãõ]/.test(lower) || /\b(você|não|saudade|coração|meu|minha|beijo|paixão|brasil)\b/i.test(lower)) {
    return 'Portuguese';
  }
  if (/[œ]/.test(lower) || /\b(amour|nuit|coeur|cœur|toujours|jamais|bonjour|merci|avec|pour|dans|mon|ton|je t'aime|stromae|angèle)\b/i.test(lower)) {
    return 'French';
  }
  if (/[ßäöü]/.test(lower) || /\b(liebe|nacht|herz|ich|dich|nicht|und|oder|welt|stern)\b/i.test(lower)) {
    return 'German';
  }
  if (/\b(amore|notte|cuore|sempre|perché|bellissima|ciao|sono|ti amo|måneskin)\b/i.test(lower)) {
    return 'Italian';
  }
  if (/\b(tum|tere|mere|tera|mera|dil|pyaar|pyar|ishq|jaan|mohabbat|zindagi|raat|arijit|pritam|shreya|atif|bollywood)\b/i.test(lower)) {
    return 'Hindi';
  }
  if (/\b(bts|blackpink|newjeans|stray kids|seventeen|aespa|twice|jung kook|jimin|taeyeon)\b/i.test(lower)) {
    return 'Korean';
  }
  if (/\b(yoasobi|kenshi yonezu|fujii kaze|radwimps|hikaru utada|one ok rock|vaundy)\b/i.test(lower)) {
    return 'Japanese';
  }

  return 'English';
}

/**
 * Derive realistic, genre-calibrated 7D Audio DNA features and K-Means cluster assignment
 * from a track's metadata (genre, title, artist).
 */
export function derive7DFeaturesFromMetadata(
  title: string,
  artist: string,
  genre: string
): { features: AudioFeatures7D; clusterId: number; clusterLabel: string } {
  const g = genre.toLowerCase();
  const seed = hashString(`${title.toLowerCase()}|${artist.toLowerCase()}|${g}`);

  let clusterId = 3;
  let base: AudioFeatures7D = {
    bpm: 118,
    energy: 0.72,
    danceability: 0.68,
    valence: 0.62,
    acousticness: 0.14,
    instrumentalness: 0.04,
    speechiness: 0.07,
  };

  if (
    g.includes('r&b') ||
    g.includes('soul') ||
    g.includes('hip-hop') ||
    g.includes('rap')
  ) {
    clusterId = 1;
    const isRap = g.includes('hip-hop') || g.includes('rap');
    base = {
      bpm: isRap ? 98 : 104,
      energy: isRap ? 0.68 : 0.54,
      danceability: isRap ? 0.78 : 0.69,
      valence: isRap ? 0.45 : 0.41,
      acousticness: isRap ? 0.12 : 0.24,
      instrumentalness: 0.02,
      speechiness: isRap ? 0.28 : 0.12,
    };
  } else if (
    g.includes('synth') ||
    g.includes('new wave') ||
    g.includes('rock') ||
    g.includes('metal') ||
    g.includes('punk')
  ) {
    clusterId = 2;
    const isHeavy = g.includes('rock') || g.includes('metal') || g.includes('punk');
    base = {
      bpm: isHeavy ? 136 : 128,
      energy: isHeavy ? 0.85 : 0.79,
      danceability: isHeavy ? 0.52 : 0.64,
      valence: isHeavy ? 0.44 : 0.46,
      acousticness: isHeavy ? 0.06 : 0.04,
      instrumentalness: 0.09,
      speechiness: 0.06,
    };
  } else if (
    g.includes('electronic') ||
    g.includes('dance') ||
    g.includes('house') ||
    g.includes('techno') ||
    g.includes('trance') ||
    g.includes('ambient')
  ) {
    clusterId = 4;
    base = {
      bpm: 122,
      energy: 0.71,
      danceability: 0.70,
      valence: 0.36,
      acousticness: 0.09,
      instrumentalness: 0.68,
      speechiness: 0.05,
    };
  } else if (
    g.includes('indie') ||
    g.includes('alternative') ||
    g.includes('folk') ||
    g.includes('singer') ||
    g.includes('acoustic') ||
    g.includes('jazz') ||
    g.includes('classical') ||
    g.includes('soundtrack')
  ) {
    clusterId = 5;
    const isAcoustic =
      g.includes('folk') ||
      g.includes('acoustic') ||
      g.includes('jazz') ||
      g.includes('classical') ||
      g.includes('singer');
    base = {
      bpm: isAcoustic ? 106 : 124,
      energy: isAcoustic ? 0.36 : 0.54,
      danceability: isAcoustic ? 0.44 : 0.53,
      valence: isAcoustic ? 0.32 : 0.35,
      acousticness: isAcoustic ? 0.76 : 0.38,
      instrumentalness: g.includes('classical') || g.includes('jazz') ? 0.78 : 0.24,
      speechiness: 0.04,
    };
  } else if (g.includes('pop') || g.includes('disco') || g.includes('funk') || g.includes('latin')) {
    clusterId = 3;
    base = {
      bpm: 116,
      energy: 0.76,
      danceability: 0.75,
      valence: 0.74,
      acousticness: 0.11,
      instrumentalness: 0.02,
      speechiness: 0.07,
    };
  }

  const jitter = (val: number, span: number, step: number, min = 0.01, max = 0.97) =>
    Number(Math.min(max, Math.max(min, val + (seededRand(seed, step) - 0.5) * span)).toFixed(2));

  const features: AudioFeatures7D = {
    bpm: Math.round(Math.min(188, Math.max(66, base.bpm + (seededRand(seed, 1) - 0.5) * 34))),
    energy: jitter(base.energy, 0.20, 2),
    danceability: jitter(base.danceability, 0.20, 3),
    valence: jitter(base.valence, 0.26, 4),
    acousticness: jitter(base.acousticness, 0.20, 5),
    instrumentalness: jitter(base.instrumentalness, 0.24, 6, 0.0, 0.95),
    speechiness: jitter(base.speechiness, 0.08, 7, 0.02, 0.48),
  };

  return {
    features,
    clusterId,
    clusterLabel: CLUSTER_META[clusterId]?.label ?? 'Sonic Cluster',
  };
}

export function computeTimbreSimilarity(aBands?: number[], bBands?: number[]): number | undefined {
  if (!aBands || !bBands || aBands.length === 0 || aBands.length !== bBands.length) {
    return undefined;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < aBands.length; i++) {
    dot += aBands[i] * bBands[i];
    magA += aBands[i] * aBands[i];
    magB += bBands[i] * bBands[i];
  }
  if (magA === 0 || magB === 0) return undefined;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export interface RankOptions {
  ignoreLanguageBoost?: boolean;
}

export function rankRecommendations(
  seed: Track,
  candidates: Track[],
  count = 60,
  options: RankOptions = {}
): RecommendedTrack[] {
  const seedTitleNorm = seed.title.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').trim();
  const seenKeys = new Set<string>([`${seedTitleNorm}|${seed.artist.toLowerCase()}`]);
  const seedLang =
    seed.language ?? detectTrackLanguage(seed.title, seed.artist, seed.genre, seed.album);
  const ignoreLanguageBoost = Boolean(options.ignoreLanguageBoost);

  interface ScoredCandidate {
    track: RecommendedTrack;
    rankScore: number;
    sameLang: boolean;
  }

  const rawScored: ScoredCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.id === seed.id) continue;
    const titleNorm = candidate.title.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const key = `${titleNorm}|${candidate.artist.toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const candLang =
      candidate.language ??
      detectTrackLanguage(
        candidate.title,
        candidate.artist,
        candidate.genre,
        candidate.album
      );
    const sameLang = candLang === seedLang;

    const cosine7D = computeCosineSimilarity(seed.features, candidate.features);
    const timbreCosine = computeTimbreSimilarity(
      seed.dsp?.timbreBands,
      candidate.dsp?.timbreBands
    );

    const blendedAcoustic =
      timbreCosine !== undefined ? cosine7D * 0.58 + timbreCosine * 0.42 : cosine7D;
    const clusterBonus = candidate.clusterId === seed.clusterId ? 0.012 : 0;
    const dspConfidenceBonus =
      seed.analysisSource === 'audio-dsp' && candidate.analysisSource === 'audio-dsp'
        ? 0.008
        : 0;
    const adjusted = Math.min(0.995, blendedAcoustic * 0.976 + clusterBonus + dspConfidenceBonus);
    const similarityPct = Number((adjusted * 100).toFixed(1));
    const timbreSimilarityPct =
      timbreCosine !== undefined ? Number((timbreCosine * 100).toFixed(1)) : undefined;

    // Strongly stick to the same language (+15 rank points) unless Pure Sound mode is active
    const langBoost = !ignoreLanguageBoost && sameLang ? 15 : 0;

    rawScored.push({
      track: {
        ...candidate,
        language: candLang,
        similarityPct,
        timbreSimilarityPct,
        dominantTraitMatch: findDominantTraitMatch(seed.features, candidate.features),
      },
      rankScore: similarityPct + langBoost,
      sameLang,
    });
  }

  rawScored.sort((a, b) => b.rankScore - a.rankScore);

  if (ignoreLanguageBoost) {
    // Pure "How It Sounds" mode: preserve light artist diversity only (max 3 per artist), ignore language
    const artistCounts = new Map<string, number>();
    const diverse: ScoredCandidate[] = [];
    const overflow: ScoredCandidate[] = [];
    for (const item of rawScored) {
      const primaryArtist =
        item.track.artist.split(/[,&]/)[0]?.trim().toLowerCase() ??
        item.track.artist.toLowerCase();
      const currentCount = artistCounts.get(primaryArtist) ?? 0;
      artistCounts.set(primaryArtist, currentCount + 1);
      if (currentCount < 3) diverse.push(item);
      else overflow.push(item);
    }
    const combined = [...diverse, ...overflow].slice(0, count);
    combined.sort((a, b) => b.rankScore - a.rankScore);
    return combined.map((c) => c.track);
  }

  // Softly promote artist diversity within same-language tracks first, then cross-language fallback
  const artistCounts = new Map<string, number>();
  const sameLangDiverse: ScoredCandidate[] = [];
  const sameLangRepeat: ScoredCandidate[] = [];
  const otherLangDiverse: ScoredCandidate[] = [];
  const otherLangRepeat: ScoredCandidate[] = [];

  for (const item of rawScored) {
    const primaryArtist =
      item.track.artist.split(/[,&]/)[0]?.trim().toLowerCase() ??
      item.track.artist.toLowerCase();
    const currentCount = artistCounts.get(primaryArtist) ?? 0;
    artistCounts.set(primaryArtist, currentCount + 1);
    if (item.sameLang) {
      if (currentCount < 3) sameLangDiverse.push(item);
      else sameLangRepeat.push(item);
    } else {
      if (currentCount < 2) otherLangDiverse.push(item);
      else otherLangRepeat.push(item);
    }
  }

  const combined = [
    ...sameLangDiverse,
    ...sameLangRepeat,
    ...otherLangDiverse,
    ...otherLangRepeat,
  ].slice(0, count);
  combined.sort((a, b) => b.rankScore - a.rankScore);
  return combined.map((c) => c.track);
}
