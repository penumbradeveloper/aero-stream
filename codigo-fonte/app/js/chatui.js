// Aero Stream - chat reutilizável (sala, mensagens privadas e grupos), no espírito do Discord:
// emojis, imagens (escolher arquivo, colar com Ctrl+V ou arrastar do computador), responder, copiar e, nas suas mensagens, editar e apagar.
// Tudo também pelo controle: cada mensagem recebe foco e as ações aparecem nela. Criado por Ryan Victtor.
(() => {
  'use strict';
  const A = window.Aero, h = A.h, T = A.T;
  const DIMS = new Map(); // (0.9.4) largura x altura das fotos/vídeos já abertos (só na memória, por id do anexo)

  // (0.7.0) TODOS os emojis do Unicode 15.1 (gerado da lista oficial emoji-test.txt), por categoria; os tons de pele entram pelo botão ✋
  const EMOJIS = {
    "😀": ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "🫠", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🫣", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😶‍🌫️", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "🫨", "🙂‍↔️", "🙂‍↕️", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🙈", "🙉", "🙊", "💋", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤"],
    "👍": ["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "🫷", "🫸", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "🫦"],
    "🤷": ["👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "🧔‍♂️", "🧔‍♀️", "👨‍🦰", "👨‍🦱", "👨‍🦳", "👨‍🦲", "👩", "👩‍🦰", "🧑‍🦰", "👩‍🦱", "🧑‍🦱", "👩‍🦳", "🧑‍🦳", "👩‍🦲", "🧑‍🦲", "👱‍♀️", "👱‍♂️", "🧓", "👴", "👵", "🙍", "🙍‍♂️", "🙍‍♀️", "🙎", "🙎‍♂️", "🙎‍♀️", "🙅", "🙅‍♂️", "🙅‍♀️", "🙆", "🙆‍♂️", "🙆‍♀️", "💁", "💁‍♂️", "💁‍♀️", "🙋", "🙋‍♂️", "🙋‍♀️", "🧏", "🧏‍♂️", "🧏‍♀️", "🙇", "🙇‍♂️", "🙇‍♀️", "🤦", "🤦‍♂️", "🤦‍♀️", "🤷", "🤷‍♂️", "🤷‍♀️", "🧑‍⚕️", "👨‍⚕️", "👩‍⚕️", "🧑‍🎓", "👨‍🎓", "👩‍🎓", "🧑‍🏫", "👨‍🏫", "👩‍🏫", "🧑‍⚖️", "👨‍⚖️", "👩‍⚖️", "🧑‍🌾", "👨‍🌾", "👩‍🌾", "🧑‍🍳", "👨‍🍳", "👩‍🍳", "🧑‍🔧", "👨‍🔧", "👩‍🔧", "🧑‍🏭", "👨‍🏭", "👩‍🏭", "🧑‍💼", "👨‍💼", "👩‍💼", "🧑‍🔬", "👨‍🔬", "👩‍🔬", "🧑‍💻", "👨‍💻", "👩‍💻", "🧑‍🎤", "👨‍🎤", "👩‍🎤", "🧑‍🎨", "👨‍🎨", "👩‍🎨", "🧑‍✈️", "👨‍✈️", "👩‍✈️", "🧑‍🚀", "👨‍🚀", "👩‍🚀", "🧑‍🚒", "👨‍🚒", "👩‍🚒", "👮", "👮‍♂️", "👮‍♀️", "🕵️", "🕵️‍♂️", "🕵️‍♀️", "💂", "💂‍♂️", "💂‍♀️", "🥷", "👷", "👷‍♂️", "👷‍♀️", "🫅", "🤴", "👸", "👳", "👳‍♂️", "👳‍♀️", "👲", "🧕", "🤵", "🤵‍♂️", "🤵‍♀️", "👰", "👰‍♂️", "👰‍♀️", "🤰", "🫃", "🫄", "🤱", "👩‍🍼", "👨‍🍼", "🧑‍🍼", "👼", "🎅", "🤶", "🧑‍🎄", "🦸", "🦸‍♂️", "🦸‍♀️", "🦹", "🦹‍♂️", "🦹‍♀️", "🧙", "🧙‍♂️", "🧙‍♀️", "🧚", "🧚‍♂️", "🧚‍♀️", "🧛", "🧛‍♂️", "🧛‍♀️", "🧜", "🧜‍♂️", "🧜‍♀️", "🧝", "🧝‍♂️", "🧝‍♀️", "🧞", "🧞‍♂️", "🧞‍♀️", "🧟", "🧟‍♂️", "🧟‍♀️", "🧌", "💆", "💆‍♂️", "💆‍♀️", "💇", "💇‍♂️", "💇‍♀️", "🚶", "🚶‍♂️", "🚶‍♀️", "🚶‍➡️", "🚶‍♀️‍➡️", "🚶‍♂️‍➡️", "🧍", "🧍‍♂️", "🧍‍♀️", "🧎", "🧎‍♂️", "🧎‍♀️", "🧎‍➡️", "🧎‍♀️‍➡️", "🧎‍♂️‍➡️", "🧑‍🦯", "🧑‍🦯‍➡️", "👨‍🦯", "👨‍🦯‍➡️", "👩‍🦯", "👩‍🦯‍➡️", "🧑‍🦼", "🧑‍🦼‍➡️", "👨‍🦼", "👨‍🦼‍➡️", "👩‍🦼", "👩‍🦼‍➡️", "🧑‍🦽", "🧑‍🦽‍➡️", "👨‍🦽", "👨‍🦽‍➡️", "👩‍🦽", "👩‍🦽‍➡️", "🏃", "🏃‍♂️", "🏃‍♀️", "🏃‍➡️", "🏃‍♀️‍➡️", "🏃‍♂️‍➡️", "💃", "🕺", "🕴️", "👯", "👯‍♂️", "👯‍♀️", "🧖", "🧖‍♂️", "🧖‍♀️", "🧗", "🧗‍♂️", "🧗‍♀️", "🤺", "🏇", "⛷️", "🏂", "🏌️", "🏌️‍♂️", "🏌️‍♀️", "🏄", "🏄‍♂️", "🏄‍♀️", "🚣", "🚣‍♂️", "🚣‍♀️", "🏊", "🏊‍♂️", "🏊‍♀️", "⛹️", "⛹️‍♂️", "⛹️‍♀️", "🏋️", "🏋️‍♂️", "🏋️‍♀️", "🚴", "🚴‍♂️", "🚴‍♀️", "🚵", "🚵‍♂️", "🚵‍♀️", "🤸", "🤸‍♂️", "🤸‍♀️", "🤼", "🤼‍♂️", "🤼‍♀️", "🤽", "🤽‍♂️", "🤽‍♀️", "🤾", "🤾‍♂️", "🤾‍♀️", "🤹", "🤹‍♂️", "🤹‍♀️", "🧘", "🧘‍♂️", "🧘‍♀️", "🛀", "🛌", "🧑‍🤝‍🧑", "👭", "👫", "👬", "💏", "👩‍❤️‍💋‍👨", "👨‍❤️‍💋‍👨", "👩‍❤️‍💋‍👩", "💑", "👩‍❤️‍👨", "👨‍❤️‍👨", "👩‍❤️‍👩", "👨‍👩‍👦", "👨‍👩‍👧", "👨‍👩‍👧‍👦", "👨‍👩‍👦‍👦", "👨‍👩‍👧‍👧", "👨‍👨‍👦", "👨‍👨‍👧", "👨‍👨‍👧‍👦", "👨‍👨‍👦‍👦", "👨‍👨‍👧‍👧", "👩‍👩‍👦", "👩‍👩‍👧", "👩‍👩‍👧‍👦", "👩‍👩‍👦‍👦", "👩‍👩‍👧‍👧", "👨‍👦", "👨‍👦‍👦", "👨‍👧", "👨‍👧‍👦", "👨‍👧‍👧", "👩‍👦", "👩‍👦‍👦", "👩‍👧", "👩‍👧‍👦", "👩‍👧‍👧", "🗣️", "👤", "👥", "🫂", "👪", "🧑‍🧑‍🧒", "🧑‍🧑‍🧒‍🧒", "🧑‍🧒", "🧑‍🧒‍🧒", "👣"],
    "❤️": ["💌", "💘", "💝", "💖", "💗", "💓", "💞", "💕", "💟", "❣️", "💔", "❤️‍🔥", "❤️‍🩹", "❤️", "🩷", "🧡", "💛", "💚", "💙", "🩵", "💜", "🤎", "🖤", "🩶", "🤍"],
    "🌊": ["🐵", "🐒", "🦍", "🦧", "🐶", "🐕", "🦮", "🐕‍🦺", "🐩", "🐺", "🦊", "🦝", "🐱", "🐈", "🐈‍⬛", "🦁", "🐯", "🐅", "🐆", "🐴", "🫎", "🫏", "🐎", "🦄", "🦓", "🦌", "🦬", "🐮", "🐂", "🐃", "🐄", "🐷", "🐖", "🐗", "🐽", "🐏", "🐑", "🐐", "🐪", "🐫", "🦙", "🦒", "🐘", "🦣", "🦏", "🦛", "🐭", "🐁", "🐀", "🐹", "🐰", "🐇", "🐿️", "🦫", "🦔", "🦇", "🐻", "🐻‍❄️", "🐨", "🐼", "🦥", "🦦", "🦨", "🦘", "🦡", "🐾", "🦃", "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊️", "🦅", "🦆", "🦢", "🦉", "🦤", "🪶", "🦩", "🦚", "🦜", "🪽", "🐦‍⬛", "🪿", "🐦‍🔥", "🐸", "🐊", "🐢", "🦎", "🐍", "🐲", "🐉", "🦕", "🦖", "🐳", "🐋", "🐬", "🦭", "🐟", "🐠", "🐡", "🦈", "🐙", "🐚", "🪸", "🪼", "🐌", "🦋", "🐛", "🐜", "🐝", "🪲", "🐞", "🦗", "🪳", "🕷️", "🕸️", "🦂", "🦟", "🪰", "🪱", "🦠", "💐", "🌸", "💮", "🪷", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🪻", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🪹", "🪺", "🍄"],
    "🍕": ["🍇", "🍈", "🍉", "🍊", "🍋", "🍋‍🟩", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🫐", "🥝", "🍅", "🫒", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶️", "🫑", "🥒", "🥬", "🥦", "🧄", "🧅", "🥜", "🫘", "🌰", "🫚", "🫛", "🍄‍🟫", "🍞", "🥐", "🥖", "🫓", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🦀", "🦞", "🦐", "🦑", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🫖", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🫗", "🥤", "🧋", "🧃", "🧉", "🧊", "🥢", "🍽️", "🍴", "🥄", "🔪", "🫙", "🏺"],
    "🚀": ["🌍", "🌎", "🌏", "🌐", "🗺️", "🗾", "🧭", "🏔️", "⛰️", "🌋", "🗻", "🏕️", "🏖️", "🏜️", "🏝️", "🏞️", "🏟️", "🏛️", "🏗️", "🧱", "🪨", "🪵", "🛖", "🏘️", "🏚️", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🕋", "⛲", "⛺", "🌁", "🌃", "🏙️", "🌄", "🌅", "🌆", "🌇", "🌉", "♨️", "🎠", "🛝", "🎡", "🎢", "💈", "🎪", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🛻", "🚚", "🚛", "🚜", "🏎️", "🏍️", "🛵", "🦽", "🦼", "🛺", "🚲", "🛴", "🛹", "🛼", "🚏", "🛣️", "🛤️", "🛢️", "⛽", "🛞", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓", "🛟", "⛵", "🛶", "🚤", "🛳️", "⛴️", "🛥️", "🚢", "✈️", "🛩️", "🛫", "🛬", "🪂", "💺", "🚁", "🚟", "🚠", "🚡", "🛰️", "🚀", "🛸", "🛎️", "🧳", "⌛", "⏳", "⌚", "⏰", "⏱️", "⏲️", "🕰️", "🕛", "🕧", "🕐", "🕜", "🕑", "🕝", "🕒", "🕞", "🕓", "🕟", "🕔", "🕠", "🕕", "🕡", "🕖", "🕢", "🕗", "🕣", "🕘", "🕤", "🕙", "🕥", "🕚", "🕦", "🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌙", "🌚", "🌛", "🌜", "🌡️", "☀️", "🌝", "🌞", "🪐", "⭐", "🌟", "🌠", "🌌", "☁️", "⛅", "⛈️", "🌤️", "🌥️", "🌦️", "🌧️", "🌨️", "🌩️", "🌪️", "🌫️", "🌬️", "🌀", "🌈", "🌂", "☂️", "☔", "⛱️", "⚡", "❄️", "☃️", "⛄", "☄️", "🔥", "💧", "🌊"],
    "🎮": ["🎃", "🎄", "🎆", "🎇", "🧨", "✨", "🎈", "🎉", "🎊", "🎋", "🎍", "🎎", "🎏", "🎐", "🎑", "🧧", "🎀", "🎁", "🎗️", "🎟️", "🎫", "🎖️", "🏆", "🏅", "🥇", "🥈", "🥉", "⚽", "⚾", "🥎", "🏀", "🏐", "🏈", "🏉", "🎾", "🥏", "🎳", "🏏", "🏑", "🏒", "🥍", "🏓", "🏸", "🥊", "🥋", "🥅", "⛳", "⛸️", "🎣", "🤿", "🎽", "🎿", "🛷", "🥌", "🎯", "🪀", "🪁", "🔫", "🎱", "🔮", "🪄", "🎮", "🕹️", "🎰", "🎲", "🧩", "🧸", "🪅", "🪩", "🪆", "♠️", "♥️", "♦️", "♣️", "♟️", "🃏", "🀄", "🎴", "🎭", "🖼️", "🎨", "🧵", "🪡", "🧶", "🪢"],
    "💡": ["👓", "🕶️", "🥽", "🥼", "🦺", "👔", "👕", "👖", "🧣", "🧤", "🧥", "🧦", "👗", "👘", "🥻", "🩱", "🩲", "🩳", "👙", "👚", "🪭", "👛", "👜", "👝", "🛍️", "🎒", "🩴", "👞", "👟", "🥾", "🥿", "👠", "👡", "🩰", "👢", "🪮", "👑", "👒", "🎩", "🎓", "🧢", "🪖", "⛑️", "📿", "💄", "💍", "💎", "🔇", "🔈", "🔉", "🔊", "📢", "📣", "📯", "🔔", "🔕", "🎼", "🎵", "🎶", "🎙️", "🎚️", "🎛️", "🎤", "🎧", "📻", "🎷", "🪗", "🎸", "🎹", "🎺", "🎻", "🪕", "🥁", "🪘", "🪇", "🪈", "📱", "📲", "☎️", "📞", "📟", "📠", "🔋", "🪫", "🔌", "💻", "🖥️", "🖨️", "⌨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀", "🧮", "🎥", "🎞️", "📽️", "🎬", "📺", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "🏮", "🪔", "📔", "📕", "📖", "📗", "📘", "📙", "📚", "📓", "📒", "📃", "📜", "📄", "📰", "🗞️", "📑", "🔖", "🏷️", "💰", "🪙", "💴", "💵", "💶", "💷", "💸", "💳", "🧾", "💹", "✉️", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳️", "✏️", "✒️", "🖋️", "🖊️", "🖌️", "🖍️", "📝", "💼", "📁", "📂", "🗂️", "📅", "📆", "🗒️", "🗓️", "📇", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇️", "📏", "📐", "✂️", "🗃️", "🗄️", "🗑️", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️", "🔨", "🪓", "⛏️", "⚒️", "🛠️", "🗡️", "⚔️", "💣", "🪃", "🏹", "🛡️", "🪚", "🔧", "🪛", "🔩", "⚙️", "🗜️", "⚖️", "🦯", "🔗", "⛓️‍💥", "⛓️", "🪝", "🧰", "🧲", "🪜", "⚗️", "🧪", "🧫", "🧬", "🔬", "🔭", "📡", "💉", "🩸", "💊", "🩹", "🩼", "🩺", "🩻", "🚪", "🛗", "🪞", "🪟", "🛏️", "🛋️", "🪑", "🚽", "🪠", "🚿", "🛁", "🪤", "🪒", "🧴", "🧷", "🧹", "🧺", "🧻", "🪣", "🧼", "🫧", "🪥", "🧽", "🧯", "🛒", "🚬", "⚰️", "🪦", "⚱️", "🧿", "🪬", "🗿", "🪧", "🪪"],
    "🔣": ["🏧", "🚮", "🚰", "♿", "🚹", "🚺", "🚻", "🚼", "🚾", "🛂", "🛃", "🛄", "🛅", "⚠️", "🚸", "⛔", "🚫", "🚳", "🚭", "🚯", "🚱", "🚷", "📵", "🔞", "☢️", "☣️", "⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️", "↕️", "↔️", "↩️", "↪️", "⤴️", "⤵️", "🔃", "🔄", "🔙", "🔚", "🔛", "🔜", "🔝", "🛐", "⚛️", "🕉️", "✡️", "☸️", "☯️", "✝️", "☦️", "☪️", "☮️", "🕎", "🔯", "🪯", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "⛎", "🔀", "🔁", "🔂", "▶️", "⏩", "⏭️", "⏯️", "◀️", "⏪", "⏮️", "🔼", "⏫", "🔽", "⏬", "⏸️", "⏹️", "⏺️", "⏏️", "🎦", "🔅", "🔆", "📶", "🛜", "📳", "📴", "♀️", "♂️", "⚧️", "✖️", "➕", "➖", "➗", "🟰", "♾️", "‼️", "⁉️", "❓", "❔", "❕", "❗", "〰️", "💱", "💲", "⚕️", "♻️", "⚜️", "🔱", "📛", "🔰", "⭕", "✅", "☑️", "✔️", "❌", "❎", "➰", "➿", "〽️", "✳️", "✴️", "❇️", "©️", "®️", "™️", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "🔠", "🔡", "🔢", "🔣", "🔤", "🅰️", "🆎", "🅱️", "🆑", "🆒", "🆓", "ℹ️", "🆔", "Ⓜ️", "🆕", "🆖", "🅾️", "🆗", "🅿️", "🆘", "🆙", "🆚", "🈁", "🈂️", "🈷️", "🈶", "🈯", "🉐", "🈹", "🈚", "🈲", "🉑", "🈸", "🈴", "🈳", "㊗️", "㊙️", "🈺", "🈵", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜", "◼️", "◻️", "◾", "◽", "▪️", "▫️", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔘", "🔳", "🔲"],
    "🏁": ["🏁", "🚩", "🎌", "🏴", "🏳️", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🇦🇨", "🇦🇩", "🇦🇪", "🇦🇫", "🇦🇬", "🇦🇮", "🇦🇱", "🇦🇲", "🇦🇴", "🇦🇶", "🇦🇷", "🇦🇸", "🇦🇹", "🇦🇺", "🇦🇼", "🇦🇽", "🇦🇿", "🇧🇦", "🇧🇧", "🇧🇩", "🇧🇪", "🇧🇫", "🇧🇬", "🇧🇭", "🇧🇮", "🇧🇯", "🇧🇱", "🇧🇲", "🇧🇳", "🇧🇴", "🇧🇶", "🇧🇷", "🇧🇸", "🇧🇹", "🇧🇻", "🇧🇼", "🇧🇾", "🇧🇿", "🇨🇦", "🇨🇨", "🇨🇩", "🇨🇫", "🇨🇬", "🇨🇭", "🇨🇮", "🇨🇰", "🇨🇱", "🇨🇲", "🇨🇳", "🇨🇴", "🇨🇵", "🇨🇷", "🇨🇺", "🇨🇻", "🇨🇼", "🇨🇽", "🇨🇾", "🇨🇿", "🇩🇪", "🇩🇬", "🇩🇯", "🇩🇰", "🇩🇲", "🇩🇴", "🇩🇿", "🇪🇦", "🇪🇨", "🇪🇪", "🇪🇬", "🇪🇭", "🇪🇷", "🇪🇸", "🇪🇹", "🇪🇺", "🇫🇮", "🇫🇯", "🇫🇰", "🇫🇲", "🇫🇴", "🇫🇷", "🇬🇦", "🇬🇧", "🇬🇩", "🇬🇪", "🇬🇫", "🇬🇬", "🇬🇭", "🇬🇮", "🇬🇱", "🇬🇲", "🇬🇳", "🇬🇵", "🇬🇶", "🇬🇷", "🇬🇸", "🇬🇹", "🇬🇺", "🇬🇼", "🇬🇾", "🇭🇰", "🇭🇲", "🇭🇳", "🇭🇷", "🇭🇹", "🇭🇺", "🇮🇨", "🇮🇩", "🇮🇪", "🇮🇱", "🇮🇲", "🇮🇳", "🇮🇴", "🇮🇶", "🇮🇷", "🇮🇸", "🇮🇹", "🇯🇪", "🇯🇲", "🇯🇴", "🇯🇵", "🇰🇪", "🇰🇬", "🇰🇭", "🇰🇮", "🇰🇲", "🇰🇳", "🇰🇵", "🇰🇷", "🇰🇼", "🇰🇾", "🇰🇿", "🇱🇦", "🇱🇧", "🇱🇨", "🇱🇮", "🇱🇰", "🇱🇷", "🇱🇸", "🇱🇹", "🇱🇺", "🇱🇻", "🇱🇾", "🇲🇦", "🇲🇨", "🇲🇩", "🇲🇪", "🇲🇫", "🇲🇬", "🇲🇭", "🇲🇰", "🇲🇱", "🇲🇲", "🇲🇳", "🇲🇴", "🇲🇵", "🇲🇶", "🇲🇷", "🇲🇸", "🇲🇹", "🇲🇺", "🇲🇻", "🇲🇼", "🇲🇽", "🇲🇾", "🇲🇿", "🇳🇦", "🇳🇨", "🇳🇪", "🇳🇫", "🇳🇬", "🇳🇮", "🇳🇱", "🇳🇴", "🇳🇵", "🇳🇷", "🇳🇺", "🇳🇿", "🇴🇲", "🇵🇦", "🇵🇪", "🇵🇫", "🇵🇬", "🇵🇭", "🇵🇰", "🇵🇱", "🇵🇲", "🇵🇳", "🇵🇷", "🇵🇸", "🇵🇹", "🇵🇼", "🇵🇾", "🇶🇦", "🇷🇪", "🇷🇴", "🇷🇸", "🇷🇺", "🇷🇼", "🇸🇦", "🇸🇧", "🇸🇨", "🇸🇩", "🇸🇪", "🇸🇬", "🇸🇭", "🇸🇮", "🇸🇯", "🇸🇰", "🇸🇱", "🇸🇲", "🇸🇳", "🇸🇴", "🇸🇷", "🇸🇸", "🇸🇹", "🇸🇻", "🇸🇽", "🇸🇾", "🇸🇿", "🇹🇦", "🇹🇨", "🇹🇩", "🇹🇫", "🇹🇬", "🇹🇭", "🇹🇯", "🇹🇰", "🇹🇱", "🇹🇲", "🇹🇳", "🇹🇴", "🇹🇷", "🇹🇹", "🇹🇻", "🇹🇼", "🇹🇿", "🇺🇦", "🇺🇬", "🇺🇲", "🇺🇳", "🇺🇸", "🇺🇾", "🇺🇿", "🇻🇦", "🇻🇨", "🇻🇪", "🇻🇬", "🇻🇮", "🇻🇳", "🇻🇺", "🇼🇫", "🇼🇸", "🇽🇰", "🇾🇪", "🇾🇹", "🇿🇦", "🇿🇲", "🇿🇼", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "🏴󠁧󠁢󠁷󠁬󠁳󠁿"],
  };
  // os que aceitam tom de pele (o modificador entra logo depois do primeiro símbolo)
  const COM_TOM = new Set(["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "🫷", "🫸", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦵", "🦶", "👂", "🦻", "👃", "👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "🧔‍♂️", "🧔‍♀️", "👨‍🦰", "👨‍🦱", "👨‍🦳", "👨‍🦲", "👩", "👩‍🦰", "🧑‍🦰", "👩‍🦱", "🧑‍🦱", "👩‍🦳", "🧑‍🦳", "👩‍🦲", "🧑‍🦲", "👱‍♀️", "👱‍♂️", "🧓", "👴", "👵", "🙍", "🙍‍♂️", "🙍‍♀️", "🙎", "🙎‍♂️", "🙎‍♀️", "🙅", "🙅‍♂️", "🙅‍♀️", "🙆", "🙆‍♂️", "🙆‍♀️", "💁", "💁‍♂️", "💁‍♀️", "🙋", "🙋‍♂️", "🙋‍♀️", "🧏", "🧏‍♂️", "🧏‍♀️", "🙇", "🙇‍♂️", "🙇‍♀️", "🤦", "🤦‍♂️", "🤦‍♀️", "🤷", "🤷‍♂️", "🤷‍♀️", "🧑‍⚕️", "👨‍⚕️", "👩‍⚕️", "🧑‍🎓", "👨‍🎓", "👩‍🎓", "🧑‍🏫", "👨‍🏫", "👩‍🏫", "🧑‍⚖️", "👨‍⚖️", "👩‍⚖️", "🧑‍🌾", "👨‍🌾", "👩‍🌾", "🧑‍🍳", "👨‍🍳", "👩‍🍳", "🧑‍🔧", "👨‍🔧", "👩‍🔧", "🧑‍🏭", "👨‍🏭", "👩‍🏭", "🧑‍💼", "👨‍💼", "👩‍💼", "🧑‍🔬", "👨‍🔬", "👩‍🔬", "🧑‍💻", "👨‍💻", "👩‍💻", "🧑‍🎤", "👨‍🎤", "👩‍🎤", "🧑‍🎨", "👨‍🎨", "👩‍🎨", "🧑‍✈️", "👨‍✈️", "👩‍✈️", "🧑‍🚀", "👨‍🚀", "👩‍🚀", "🧑‍🚒", "👨‍🚒", "👩‍🚒", "👮", "👮‍♂️", "👮‍♀️", "🕵️", "🕵️‍♂️", "🕵️‍♀️", "💂", "💂‍♂️", "💂‍♀️", "🥷", "👷", "👷‍♂️", "👷‍♀️", "🫅", "🤴", "👸", "👳", "👳‍♂️", "👳‍♀️", "👲", "🧕", "🤵", "🤵‍♂️", "🤵‍♀️", "👰", "👰‍♂️", "👰‍♀️", "🤰", "🫃", "🫄", "🤱", "👩‍🍼", "👨‍🍼", "🧑‍🍼", "👼", "🎅", "🤶", "🧑‍🎄", "🦸", "🦸‍♂️", "🦸‍♀️", "🦹", "🦹‍♂️", "🦹‍♀️", "🧙", "🧙‍♂️", "🧙‍♀️", "🧚", "🧚‍♂️", "🧚‍♀️", "🧛", "🧛‍♂️", "🧛‍♀️", "🧜", "🧜‍♂️", "🧜‍♀️", "🧝", "🧝‍♂️", "🧝‍♀️", "💆", "💆‍♂️", "💆‍♀️", "💇", "💇‍♂️", "💇‍♀️", "🚶", "🚶‍♂️", "🚶‍♀️", "🚶‍➡️", "🚶‍♀️‍➡️", "🚶‍♂️‍➡️", "🧍", "🧍‍♂️", "🧍‍♀️", "🧎", "🧎‍♂️", "🧎‍♀️", "🧎‍➡️", "🧎‍♀️‍➡️", "🧎‍♂️‍➡️", "🧑‍🦯", "🧑‍🦯‍➡️", "👨‍🦯", "👨‍🦯‍➡️", "👩‍🦯", "👩‍🦯‍➡️", "🧑‍🦼", "🧑‍🦼‍➡️", "👨‍🦼", "👨‍🦼‍➡️", "👩‍🦼", "👩‍🦼‍➡️", "🧑‍🦽", "🧑‍🦽‍➡️", "👨‍🦽", "👨‍🦽‍➡️", "👩‍🦽", "👩‍🦽‍➡️", "🏃", "🏃‍♂️", "🏃‍♀️", "🏃‍➡️", "🏃‍♀️‍➡️", "🏃‍♂️‍➡️", "💃", "🕺", "🕴️", "🧖", "🧖‍♂️", "🧖‍♀️", "🧗", "🧗‍♂️", "🧗‍♀️", "🏇", "🏂", "🏌️", "🏌️‍♂️", "🏌️‍♀️", "🏄", "🏄‍♂️", "🏄‍♀️", "🚣", "🚣‍♂️", "🚣‍♀️", "🏊", "🏊‍♂️", "🏊‍♀️", "⛹️", "⛹️‍♂️", "⛹️‍♀️", "🏋️", "🏋️‍♂️", "🏋️‍♀️", "🚴", "🚴‍♂️", "🚴‍♀️", "🚵", "🚵‍♂️", "🚵‍♀️", "🤸", "🤸‍♂️", "🤸‍♀️", "🤽", "🤽‍♂️", "🤽‍♀️", "🤾", "🤾‍♂️", "🤾‍♀️", "🤹", "🤹‍♂️", "🤹‍♀️", "🧘", "🧘‍♂️", "🧘‍♀️", "🛀", "🛌", "👭", "👫", "👬", "💏", "💑"]);
  const TONS = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
  const comTom = (e, cat, tom) => { if (!tom || !COM_TOM.has(e)) return e; const cps = [...e]; const base = cps[0]; let resto = cps.slice(1); if (resto[0] === '\uFE0F') resto = resto.slice(1); return base + tom + resto.join(''); };
  const NOMES_CAT = { '😀': ['Carinhas', 'Faces'], '👍': ['Mãos e corpo', 'Hands & body'], '🤷': ['Pessoas', 'People'], '❤️': ['Corações', 'Hearts'], '🌊': ['Animais e natureza', 'Animals & nature'], '🍕': ['Comida', 'Food'], '🚀': ['Viagens e lugares', 'Travel & places'], '🎮': ['Atividades', 'Activities'], '💡': ['Objetos', 'Objects'], '🔣': ['Símbolos', 'Symbols'], '🏁': ['Bandeiras', 'Flags'] };

  // texto -> nós (links clicáveis que abrem fora; nada de HTML do outro lado)
  // (0.6.0) também: menções "<@CODIGO>" (viram "@Nome" destacado) e figurinhas "<fig:CODIGO:ID>"
  // (0.6.9) e "<@todos>" (todo mundo da conversa) e "<@aqui>" (só quem está online), como o @everyone e o @here do Discord
  const RE_TOKENS = /\bhttps?:\/\/[^\s<>"']+|<@([A-Z0-9]{6})>|<fig:([A-Z0-9]{6}):([0-9a-f]{10})>|<@(todos|aqui)>|<em:([A-Z0-9]{6}):([0-9a-f]{10}):([a-z0-9_]{2,24})>/gi; // (1.0.0) + emojis próprios
  function comLinks(texto, o = {}) {
    const out = []; let i = 0, m; RE_TOKENS.lastIndex = 0;
    while ((m = RE_TOKENS.exec(texto))) {
      if (m.index > i) out.push(texto.slice(i, m.index));
      if (m[1]) { const cod = m[1].toUpperCase(), eu = A.api.eu && A.api.eu.codigo === cod; out.push(h('span', { class: 'cx-mencao' + (eu ? ' eu' : ''), dados: { cod }, onclick: (e) => { e.stopPropagation(); if (A.perfil && A.perfil.mini) A.perfil.mini(cod, e.currentTarget); } }, '@' + (o.nomeDe ? o.nomeDe(cod) : cod))); }
      else if (m[5]) { // (1.0.0) emoji próprio: se o plano de quem criou acabou, fica o :nome:
        const nome = ':' + m[7].toLowerCase() + ':', img = h('img', { class: 'cx-emoji-pr', src: `${A.api.servidor}/api/emoji/${m[5].toUpperCase()}/${m[6]}`, alt: nome, title: nome, loading: 'lazy', draggable: 'false' });
        img.addEventListener('error', () => img.replaceWith(nome)); out.push(img);
        img.addEventListener('contextmenu', (e) => { // (1.0.2) importar o emoji de alguém para as suas figurinhas
          const F = A.talk && A.talk.figurinhas; if (!F || !F.importar) return; e.preventDefault(); e.stopPropagation();
          A.ui.menuContexto(e, [{ texto: T('Importar para as minhas figurinhas', 'Import to my stickers'), icone: 'figurinha', onclick: async () => { try { await F.importar(img.src, m[7].toLowerCase()); A.som.tocar('sucesso'); A.ui.toast(T('Figurinha criada: ', 'Sticker created: ') + nome); } catch (er) { A.ui.toast(er.message, { tipo: 'erro' }); } } },
            { texto: T('Copiar ', 'Copy ') + nome, icone: 'copiar', onclick: () => { try { navigator.clipboard.writeText(nome); } catch (_) { /* ok */ } } }]);
        });
      }
      else if (m[4]) out.push(h('span', { class: 'cx-mencao todos', title: m[4].toLowerCase() === 'aqui' ? T('Todo mundo online na conversa', 'Everyone online in the chat') : T('Todo mundo da conversa', 'Everyone in the chat') }, '@' + m[4].toLowerCase()));
      else if (m[2]) {
        const cod = m[2].toUpperCase(), id = m[3], img = h('img', { class: 'cx-figurinha', src: `${A.api.servidor}/api/figurinha/${cod}/${id}`, alt: T('figurinha', 'sticker'), title: T('Ver figurinha', 'View sticker'), loading: 'lazy', draggable: 'false' });
        img.addEventListener('click', (e) => { e.stopPropagation(); A.ui.verImagem(img.src, { nome: 'figurinha-' + id + '.png' }); }); // (0.9.7) abre grande, com zoom, como as imagens
        out.push(o.figurinhas && o.figurinhas.favoritar ? figComEstrela(img, cod, id, o) : img);
      }
      else out.push(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer' }, m[0]));
      i = m.index + m[0].length;
    }
    if (i < texto.length) out.push(texto.slice(i));
    return out;
  }
  // (0.8.5) a figurinha no chat ganha a estrela de favoritar no canto (como os GIFs) e o botão direito
  // (0.9.7) o pedaço da mensagem respondida: figurinha vira a miniatura dela, GIF vira "GIF" (antes aparecia o código ou o link)
  const RE_FIG_SO = /^\s*<fig:([A-Z0-9]{6}):([0-9a-f]{10})>\s*$/i, RE_GIF_SO = /^\s*https?:\/\/(?:[^\s/]*\.)?(?:klipy|tenor|giphy)\.com\/\S*\s*$|^\s*https?:\/\/\S+\.gif(?:[?#]\S*)?\s*$/i;
  function resumoTrecho(t, img) {
    t = String(t || '');
    const f = RE_FIG_SO.exec(t);
    if (f) return [h('img', { class: 'cx-cit-fig', src: `${A.api.servidor}/api/figurinha/${f[1].toUpperCase()}/${f[2]}`, alt: '', loading: 'lazy', draggable: 'false' }), T('Figurinha', 'Sticker')];
    if (RE_GIF_SO.test(t)) return ['GIF'];
    if (!t) return [img ? T('[imagem]', '[image]') : ''];
    return [t.replace(/<fig:[A-Z0-9]{6}:[0-9a-f]{10}>/gi, T('[figurinha]', '[sticker]')).replace(/<em:[A-Z0-9]{6}:[0-9a-f]{10}:([a-z0-9_]{2,24})>/gi, ':$1:')];
  }
  function figComEstrela(img, cod, id, o) {
    const F = o.figurinhas;
    const est = h('button', { type: 'button', class: 'cx-gif-fav cx-fig-fav', title: T('Favoritar figurinha', 'Favorite sticker') }, A.icone('estrela', 15));
    const pintar = () => { const on = F.eFavorita(cod, id); est.classList.toggle('on', on); est.title = on ? T('Tirar das favoritas', 'Remove from favorites') : T('Favoritar figurinha', 'Favorite sticker'); };
    const trocar = () => F.favoritar(cod, id, !F.eFavorita(cod, id)).then(pintar, (e) => A.ui.toast(e.message, { tipo: 'erro' }));
    est.addEventListener('click', (e) => { e.stopPropagation(); trocar(); });
    const caixa = h('span', { class: 'cx-fig-msg' }, img, est);
    caixa.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); A.ui.menuContexto(e, [{ texto: F.eFavorita(cod, id) ? T('Tirar das favoritas', 'Remove from favorites') : T('Favoritar figurinha', 'Favorite sticker'), icone: 'estrela', onclick: trocar }]); });
    if (F.favoritas) F.favoritas().then(pintar, () => {}); else pintar();
    return caixa;
  }
  const mencoes = (texto) => { const l = []; let m; const re = /<@([A-Z0-9]{6})>/gi; while ((m = re.exec(texto || ''))) l.push(m[1].toUpperCase()); return l; };
  // (0.6.9) a mensagem chama você? (pelo nome, por @todos, ou por @aqui se você está online)
  const meChama = (texto) => { const eu = A.api.eu; if (!eu || !texto) return false; if (mencoes(texto).includes(eu.codigo) || /<@todos>/i.test(texto)) return true; return /<@aqui>/i.test(texto) && (!A.hub || A.hub.estado === 'online'); };
  A.chatMeChama = meChama;
  // ---------- embeds (0.6.0): YouTube como no Discord, GIFs (Klipy) e convites de grupo ----------
  const ehSpotify = (u) => /^https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode)\/[A-Za-z0-9]{22}/i.test(u); // (1.0.2)
  const idYoutube = (u) => { const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u); return m ? m[1] : null; };
  const ehGif = (u) => /^https:\/\/([a-z0-9-]+\.)*(klipy\.com|klipy\.co)\/[^\s]+\.(gif|webp)(\?[^\s]*)?$/i.test(u);
  const codigoConvite = (u) => { const m = /(?:#convite=|aerostream:\/\/convite\/)([0-9A-F]{10})\b/i.exec(u); return m ? m[1].toUpperCase() : null; };
  // (0.7.1) link de PÁGINA do Klipy (klipy.com/gifs/nome): o servidor descobre o GIF de verdade
  const ehPaginaKlipy = (u) => /^https:\/\/(?:www\.)?klipy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:gifs|stickers)\/[a-z0-9-]{1,120}\/?(?:[?#][^\s]*)?$/i.test(u);
  // dados do embed pelo servidor (título do YouTube, GIF do Klipy), uma vez por link
  const embeds = new Map();
  const dadosEmbed = (u) => { if (!embeds.has(u)) { const p = A.api && A.api.token ? A.api.req('embed?u=' + encodeURIComponent(u)).catch(() => null) : Promise.resolve(null); embeds.set(u, p); } return embeds.get(u); };
  // (0.7.1) YouTube no estilo do Aero. (0.9.6) refeito: a capa grande com o play de vidro e o selo do YouTube; embaixo o título (até 2 linhas)
  // e o canal. O link fica escondido no cartão: clicar no título abre no YouTube e o botão direito em qualquer lugar copia o link
  const menuLink = (url, nome, extra) => (e) => { e.preventDefault(); e.stopPropagation(); const mais = extra ? extra() : []; A.ui.menuContexto(e, [{ texto: T('Copiar link', 'Copy link'), icone: 'copiar', onclick: () => A.ui.copiar(url) }, { texto: T('Abrir no ', 'Open on ') + nome, icone: 'externo', onclick: () => A.ui.abrirFora(url) }, ...(mais.length ? [null, ...mais] : [])]); };
  const marcaYt = (t) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 28 20'); s.setAttribute('width', t); s.setAttribute('height', Math.round(t * 20 / 28)); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<rect width="28" height="20" rx="6" fill="#ff0033"/><path d="M11 5.6v8.8L18.6 10z" fill="#fff"/>'; return s; };
  function embedYoutube(id, link, extra) {
    const url = link || 'https://www.youtube.com/watch?v=' + id, curto = /\/shorts\//.test(url);
    const caixa = h('div', { class: 'cx-yt' + (curto ? ' curto' : '') });
    const capa = h('button', { type: 'button', class: 'cx-yt-capa', title: T('Assistir aqui', 'Watch here'), 'aria-label': T('Assistir aqui', 'Watch here') },
      h('img', { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }),
      h('span', { class: 'cx-yt-selo' }, marcaYt(16), curto ? 'Shorts' : 'YouTube'),
      h('span', { class: 'cx-yt-play' }, A.icone('play', 28)));
    capa.addEventListener('click', (e) => { e.stopPropagation(); caixa.classList.add('tocando'); caixa.replaceChildren(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', title: 'YouTube', referrerpolicy: 'strict-origin-when-cross-origin' })); });
    caixa.append(capa);
    const titulo = h('a', { class: 'cx-yt-titulo', href: url, target: '_blank', rel: 'noopener noreferrer', title: T('Abrir no YouTube (botão direito: copiar o link)', 'Open on YouTube (right-click: copy link)') }, T('Vídeo do YouTube', 'YouTube video'));
    titulo.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); A.ui.abrirFora(url); });
    const canal = h('span', { class: 'cx-yt-canal' }, 'YouTube');
    const ir = h('button', { type: 'button', class: 'cx-yt-ir', title: T('Abrir no YouTube', 'Open on YouTube'), onclick: (e) => { e.stopPropagation(); A.ui.abrirFora(url); } }, A.icone('externo', 15));
    const info = h('div', { class: 'cx-yt-info' }, h('span', { class: 'cx-yt-logo' }, marcaYt(22)), h('div', { class: 'cx-yt-txt' }, titulo, canal), ir);
    dadosEmbed(url).then((d) => { if (!d || d.tipo !== 'youtube') return; if (d.titulo) { titulo.textContent = d.titulo; capa.setAttribute('aria-label', T('Assistir: ', 'Watch: ') + d.titulo); } if (d.autor) canal.textContent = d.autor; });
    const cartao = h('div', { class: 'cx-midia cx-yt-cartao' }, caixa, info);
    cartao.addEventListener('contextmenu', menuLink(url, 'YouTube', extra));
    return A.ui.pelicula(cartao);
  }
  // (0.9.5) post do Twitter/X: autor, texto, números, fotos (abrem na galeria com setas) e vídeos que tocam aqui mesmo. As fotos passam pelo
  // servidor do Aero (o aparelho não fala com o X só por ver o cartão); o vídeo só vem do X quando a pessoa aperta play
  const idTweet = (u) => { const m = /^https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com|fixvx\.com)\/(?:[A-Za-z0-9_]{1,15}|i\/web|i)\/status(?:es)?\/(\d{5,25})/i.exec(u); return m ? m[1] : null; };
  const pelaCapa = (u) => (u && A.api ? `${A.api.servidor}/api/capa?u=${encodeURIComponent(u)}` : '');
  const marcaX = (t) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', t); s.setAttribute('height', t); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>'; return s; };
  const videoTw = (u) => (u && A.api ? `${A.api.servidor}/api/twvideo?u=${encodeURIComponent(u)}` : '');
  const fotoTw = (u, tam) => pelaCapa(u + '?format=jpg&name=' + tam);
  const numCurto = (n) => { if (n == null) return ''; try { return new Intl.NumberFormat(A.idioma && A.idioma() === 'en' ? 'en' : 'pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (e) { return String(n); } };
  let playerAero = null; // (0.9.6) o player de vídeo do chat (com tela cheia, volume, barra...), para os vídeos do post do X
  function embedTweet(u, grudar = () => {}, soLink = false, extra = null) {
    const U = A.ui;
    const caixa = h('div', { class: 'cx-midia cx-tw cx-tw-carregando' }, h('div', { class: 'cx-tw-esq' }));
    const el = U.pelicula(caixa);
    dadosEmbed(u).then((d) => {
      if (!d || d.tipo !== 'tweet') { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...U.textoComLinks(u)) : h('span')); return; } // (0.9.6) sem prévia: volta o link
      const url = d.url || u, abrir = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } U.abrirFora(url); };
      const a = d.autor || {};
      const av = a.av ? h('img', { class: 'cx-tw-av', src: pelaCapa(a.av), alt: '', loading: 'lazy', draggable: 'false' }) : h('span', { class: 'cx-tw-av' });
      const topo = h('div', { class: 'cx-tw-topo' }, av,
        h('a', { class: 'cx-tw-quem', href: 'https://x.com/' + a.nick, onclick: (e) => { e.preventDefault(); e.stopPropagation(); U.abrirFora('https://x.com/' + a.nick); } },
          h('b', null, a.nome || a.nick, a.ok ? h('span', { class: 'cx-tw-ok', title: T('Verificado', 'Verified') }, A.icone('check', 11)) : null), h('small', null, '@' + a.nick)),
        h('span', { class: 'cx-tw-logo', 'aria-hidden': 'true' }, marcaX(14)));
      const partes = [topo];
      if (d.texto) partes.push(h('div', { class: 'cx-tw-txt' }, ...U.textoComLinks(d.texto)));
      const ms = d.midias || [];
      if (ms.length) {
        const n = ms.length, g = h('div', { class: 'cx-tw-midias cx-grade n' + n + (n === 1 ? ' um' : '') + (d.sens ? ' sens' : '') });
        if (n === 1 && ms[0].w && ms[0].h) g.style.aspectRatio = Math.max(0.6, Math.min(2.4, ms[0].w / ms[0].h)).toFixed(3);
        const fotos = ms.map((m) => ({ url: m.tipo === 'foto' ? fotoTw(m.url, 'large') : videoTw(m.url), video: m.tipo !== 'foto', nome: 'x-' + (m.tipo === 'foto' ? 'foto.jpg' : 'video.mp4'), link: url }));
        ms.forEach((m, i) => {
          const cel = h('button', { type: 'button', class: 'cx-gcel' + (m.tipo !== 'foto' ? ' video' : ''), tabindex: '-1' });
          if (m.tipo === 'foto') {
            cel.append(h('img', { src: fotoTw(m.url, n === 1 ? 'medium' : 'small'), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }));
            cel.addEventListener('click', (e) => { e.stopPropagation(); if (g.classList.contains('sens')) return; U.verImagem(fotos[i].url, { nome: fotos[i].nome, link: url, galeria: { itens: fotos, i } }); });
          } else {
            if (m.capa) cel.append(h('img', { src: pelaCapa(m.capa), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }));
            cel.append(h('span', { class: 'cx-gplay' }, A.icone('play', 22)));
            if (m.tipo === 'gif') cel.append(h('span', { class: 'cx-tw-selo' }, 'GIF'));
            else if (m.dur) cel.append(h('span', { class: 'cx-tw-selo' }, Math.floor(m.dur / 60) + ':' + String(m.dur % 60).padStart(2, '0')));
            cel.addEventListener('click', (e) => {
              e.stopPropagation(); if (g.classList.contains('sens')) return;
              const gif = m.tipo === 'gif';
              // (0.9.6) vídeo de verdade usa o player do Aero (os botões aparecem ao passar o mouse); GIF continua em loop, sem som
              if (!gif && playerAero) {
                const pl = playerAero(videoTw(m.url), null), v = pl.querySelector('video');
                if (m.capa) v.poster = pelaCapa(m.capa);
                const vivo = h('div', { class: 'cx-gcel tocando' }, pl);
                vivo.addEventListener('click', (ev) => ev.stopPropagation());
                cel.replaceWith(vivo); const b = pl.querySelector('.mp-grande'); if (b) b.click();
                return;
              }
              const v = h('video', { src: videoTw(m.url), class: 'cx-tw-video', autoplay: '', playsinline: '', ...(gif ? { loop: '', muted: '' } : { controls: '' }), poster: m.capa ? pelaCapa(m.capa) : null });
              if (gif) v.muted = true;
              const vivo = h('div', { class: 'cx-gcel tocando' }, v);
              v.addEventListener('click', (ev) => ev.stopPropagation());
              cel.replaceWith(vivo);
            });
          }
          g.append(cel);
        });
        if (d.sens) {
          const aviso = h('button', { type: 'button', class: 'cx-tw-aviso', onclick: (e) => { e.stopPropagation(); g.classList.remove('sens'); aviso.remove(); } }, A.icone('olho', 16), T('Conteúdo sensível. Clique para ver', 'Sensitive content. Click to view'));
          partes.push(h('div', { class: 'cx-tw-midia-caixa' }, g, aviso));
        } else partes.push(g);
      }
      const st = (ic, v, tit) => (v == null ? null : h('span', { class: 'cx-tw-num', title: tit }, A.icone(ic, 14), numCurto(v)));
      const quando = d.t ? (() => { try { return new Intl.DateTimeFormat(A.idioma && A.idioma() === 'en' ? 'en' : 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d.t)); } catch (e) { return ''; } })() : '';
      partes.push(h('div', { class: 'cx-tw-nums' }, st('responder', d.resp, T('Respostas', 'Replies')), st('atualizar', d.rt, T('Reposts', 'Reposts')), st('coracao', d.cur, T('Curtidas', 'Likes')), st('olho', d.views, T('Visualizações', 'Views'))));
      const rod = h('a', { class: 'cx-tw-rod', href: url, title: T('Abrir no X (botão direito: copiar o link)', 'Open on X (right-click: copy link)'), onclick: abrir }, marcaX(11), h('span', null, 'X' + (quando ? ' · ' + quando : '')));
      partes.push(rod);
      caixa.addEventListener('contextmenu', (e) => { if (!e.target.closest('.cx-gcel')) menuLink(url, 'X', extra)(e); }); // (0.9.6) o link fica escondido: botão direito copia
      caixa.classList.remove('cx-tw-carregando'); caixa.replaceChildren(...partes); grudar();
    });
    return el;
  }
  // (1.0.2) post do Reddit: sub, autor, título, texto, fotos (até 20, abrem na galeria com setas) e o vídeo que toca aqui mesmo, com som
  const ehReddit = (u) => /^https?:\/\/(?:(?:www|old|new|np|m|sh)\.)?reddit\.com\/(?:r\/[A-Za-z0-9_]{2,21}\/)?(?:comments|s)\/[A-Za-z0-9]{3,12}/i.test(u);
  const ehLoja = (u) => /^https?:\/\/(?:(?:www|pt|m|smile)\.)?(?:amazon\.(?:com\.br|com|co\.uk|de|es|fr|it|ca|co\.jp|com\.mx)\/(?:[^\s]*\/)?(?:dp|gp\/product|d)\/|(?:a\.)?aliexpress\.(?:com|us|ru)\/(?:item|i)\/|amzn\.(?:to|eu|com)\/|a\.co\/)/i.test(u);
  const marcaReddit = (t) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', t); s.setAttribute('height', t); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<circle cx="12" cy="12" r="12" fill="#FF4500"/><path fill="#fff" d="M19.6 12a1.7 1.7 0 0 0-2.9-1.2 8.4 8.4 0 0 0-4.5-1.4l.8-3.6 2.5.5a1.2 1.2 0 1 0 .1-.7l-2.8-.6a.3.3 0 0 0-.4.3l-.9 4.1a8.4 8.4 0 0 0-4.6 1.4 1.7 1.7 0 1 0-1.9 2.8 3.3 3.3 0 0 0 0 .5c0 2.6 3 4.7 6.7 4.7s6.7-2.1 6.7-4.7a3.3 3.3 0 0 0 0-.5 1.7 1.7 0 0 0 1.2-1.6zM8.3 13.2a1.2 1.2 0 1 1 1.2 1.2 1.2 1.2 0 0 1-1.2-1.2zm6.6 3.2a4.4 4.4 0 0 1-2.9.9 4.4 4.4 0 0 1-2.9-.9.3.3 0 0 1 .4-.4 3.7 3.7 0 0 0 2.5.7 3.7 3.7 0 0 0 2.5-.7.3.3 0 1 1 .4.4zm-.3-2a1.2 1.2 0 1 1 1.2-1.2 1.2 1.2 0 0 1-1.2 1.2z"/>'; return s; };
  function embedReddit(u, grudar = () => {}, soLink = false, extra = null) {
    const U = A.ui;
    const caixa = h('div', { class: 'cx-midia cx-tw cx-rd cx-tw-carregando' }, h('div', { class: 'cx-tw-esq' }));
    const el = U.pelicula(caixa);
    dadosEmbed(u).then((d) => {
      if (!d || d.tipo !== 'reddit') { el.replaceWith(soLink ? h('div', { class: 'cx-txt' }, ...U.textoComLinks(u)) : h('span')); return; }
      const url = d.url || u, abrir = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } U.abrirFora(url); };
      const topo = h('div', { class: 'cx-tw-topo' }, h('span', { class: 'cx-rd-av' }, marcaReddit(36)),
        h('a', { class: 'cx-tw-quem', href: 'https://www.reddit.com/r/' + d.sub, onclick: (e) => { e.preventDefault(); e.stopPropagation(); U.abrirFora('https://www.reddit.com/r/' + d.sub); } },
          h('b', null, 'r/' + d.sub), d.autor ? h('small', null, 'u/' + d.autor) : null),
        d.nsfw ? h('span', { class: 'cx-rd-nsfw' }, 'NSFW') : null);
      const partes = [topo, h('div', { class: 'cx-rd-titulo' }, d.titulo)];
      if (d.texto) partes.push(h('div', { class: 'cx-tw-txt cx-rd-txt' }, ...U.textoComLinks(d.texto)));
      const ms = d.midias || [];
      if (d.video) {
        const v = d.video, cel = h('button', { type: 'button', class: 'cx-gcel video', tabindex: '-1' });
        if (v.capa) cel.append(h('img', { src: v.capa, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false', referrerpolicy: 'no-referrer' }));
        cel.append(h('span', { class: 'cx-gplay' }, A.icone('play', 22)));
        cel.addEventListener('click', (e) => {
          e.stopPropagation(); if (g.classList.contains('sens')) return;
          const vid = h('video', { src: v.url, class: 'cx-tw-video', autoplay: '', playsinline: '', controls: '', poster: v.capa || null, referrerpolicy: 'no-referrer' });
          if (v.som) { // o Reddit manda a imagem e o som separados: os dois andam juntos
            const a = new Audio(v.som); a.preload = 'auto';
            const junto = () => { if (Math.abs(a.currentTime - vid.currentTime) > 0.25) a.currentTime = vid.currentTime; };
            vid.addEventListener('play', () => { junto(); a.play().catch(() => {}); }); vid.addEventListener('pause', () => a.pause()); vid.addEventListener('waiting', () => a.pause());
            vid.addEventListener('playing', () => { junto(); a.play().catch(() => {}); }); vid.addEventListener('seeked', junto); vid.addEventListener('timeupdate', () => { if (!vid.isConnected) { a.pause(); return; } if (Math.abs(a.currentTime - vid.currentTime) > 0.4) a.currentTime = vid.currentTime; });
            vid.addEventListener('volumechange', () => { a.volume = vid.volume; a.muted = vid.muted; }); vid.addEventListener('ratechange', () => { a.playbackRate = vid.playbackRate; });
          }
          const vivo = h('div', { class: 'cx-gcel tocando' }, vid); vid.addEventListener('click', (ev) => ev.stopPropagation()); cel.replaceWith(vivo);
        });
        var g = h('div', { class: 'cx-tw-midias cx-grade n1 um' + (d.nsfw ? ' sens' : '') }, cel); g.style.aspectRatio = '16 / 9';
      } else if (ms.length) {
        const todas = ms.slice(0, 20), vis = todas.length > 9 ? todas.slice(0, 9) : todas, n = vis.length;
        var g = h('div', { class: 'cx-tw-midias cx-grade n' + n + (n === 1 ? ' um' : '') + (n > 4 ? ' muitos' : '') + (d.nsfw ? ' sens' : '') });
        const fotos = todas.map((m, i) => ({ url: m.url, video: false, nome: 'reddit-' + (i + 1) + '.jpg', link: url }));
        vis.forEach((m, i) => {
          const cel = h('button', { type: 'button', class: 'cx-gcel', tabindex: '-1' }, h('img', { src: m.url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false', referrerpolicy: 'no-referrer' }));
          if (todas.length > 9 && i === 8) { cel.classList.add('cx-gmais'); cel.append(h('span', { class: 'cx-gmais-n' }, '+' + (todas.length - 8))); }
          cel.addEventListener('click', (e) => { e.stopPropagation(); if (g.classList.contains('sens')) return; U.verImagem(fotos[i].url, { nome: fotos[i].nome, link: url, galeria: { itens: fotos, i } }); });
          g.append(cel);
        });
      }
      if (g) {
        if (d.nsfw) { const aviso = h('button', { type: 'button', class: 'cx-tw-aviso', onclick: (e) => { e.stopPropagation(); g.classList.remove('sens'); aviso.remove(); } }, A.icone('olho', 16), T('Conteúdo +18. Clique para ver', '18+ content. Click to view')); partes.push(h('div', { class: 'cx-tw-midia-caixa' }, g, aviso)); }
        else partes.push(g);
      }
      const st = (ic, v, tit) => (v == null ? null : h('span', { class: 'cx-tw-num', title: tit }, A.icone(ic, 14), numCurto(v)));
      if (d.pontos != null || d.coment != null) partes.push(h('div', { class: 'cx-tw-nums' }, st('subir', d.pontos, T('Pontos', 'Upvotes')), st('responder', d.coment, T('Comentários', 'Comments'))));
      const qd = d.t ? (() => { try { return new Intl.DateTimeFormat(A.idioma && A.idioma() === 'en' ? 'en' : 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d.t)); } catch (e) { return ''; } })() : '';
      partes.push(h('a', { class: 'cx-tw-rod', href: url, title: T('Abrir no Reddit (botão direito: copiar o link)', 'Open on Reddit (right-click: copy link)'), onclick: abrir }, marcaReddit(12), h('span', null, 'Reddit' + (qd ? ' · ' + qd : ''))));
      caixa.addEventListener('contextmenu', (e) => { if (!e.target.closest('.cx-gcel')) menuLink(url, 'Reddit', extra)(e); });
      caixa.classList.remove('cx-tw-carregando'); caixa.replaceChildren(...partes); grudar();
    });
    return el;
  }
  // (0.5.9-9) um formatador só (por idioma): "toLocaleTimeString" monta um novo a cada mensagem, e isso era o que mais pesava depois do layout
  const formatos = {};
  const hora = (t) => { try { const l = A.idioma && A.idioma() === 'en' ? 'en' : 'pt-BR'; return (formatos[l] || (formatos[l] = new Intl.DateTimeFormat(l, { hour: '2-digit', minute: '2-digit' }))).format(new Date(t)); } catch (e) { return ''; } };
  const exata = (t) => { try { const l = A.idioma && A.idioma() === 'en' ? 'en-x' : 'pt-x'; return (formatos[l] || (formatos[l] = new Intl.DateTimeFormat(l.slice(0, 2) === 'en' ? 'en' : 'pt-BR', { dateStyle: 'full', timeStyle: 'short' }))).format(new Date(t)); } catch (e) { return ''; } };
  // (0.7.8) hoje mostra a hora; depois ontem, dias, semanas, meses, anos e décadas (a data exata fica ao passar o mouse)
  const quando = (t, agora = Date.now()) => {
    const d = new Date(t), n = new Date(agora), meiaNoite = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dias = Math.round((meiaNoite(n) - meiaNoite(d)) / 86400000);
    if (dias <= 0) return hora(t);
    if (dias === 1) return T('ontem', 'yesterday');
    const ha = (q, pt, pts, en) => T('há ' + q + ' ' + (q === 1 ? pt : pts), q + ' ' + en + (q === 1 ? '' : 's') + ' ago');
    if (dias < 7) return ha(dias, 'dia', 'dias', 'day');
    const meses = (n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth() - (n.getDate() < d.getDate() ? 1 : 0);
    if (meses < 1) return ha(Math.floor(dias / 7), 'semana', 'semanas', 'week');
    if (meses < 12) return ha(meses, 'mês', 'meses', 'month');
    const anos = Math.floor(meses / 12);
    if (anos < 10) return ha(anos, 'ano', 'anos', 'year');
    return ha(Math.floor(anos / 10), 'década', 'décadas', 'decade');
  };
  const selo = (t) => h('span', { class: 'cx-hora', title: exata(t), dados: { t } }, quando(t));
  let diaVisto = new Date().toDateString();
  setInterval(() => { const dia = new Date().toDateString(); if (dia === diaVisto) return; diaVisto = dia; document.querySelectorAll('.cx-hora[data-t]').forEach((x) => { x.textContent = quando(+x.dataset.t); }); }, 60000); // chat aberto de um dia para o outro

  // (0.8.3) tira os dados escondidos da foto (EXIF: localização do GPS, aparelho, data) SEM mexer nos pixels. JPEG: remove os blocos
  // APP1-APP15 e os comentários; PNG: remove os blocos de texto e EXIF. Foto de celular girada pelo EXIF (orientação != 1) e outros
  // formatos voltam null: aí a imagem é refeita em qualidade alta (o que também apaga os metadados, como era antes).
  async function semMetadados(arquivo) {
    try {
      const u = new Uint8Array(await arquivo.arrayBuffer());
      if (arquivo.type === 'image/png' && u[0] === 0x89 && u[1] === 0x50) {
        const fora = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']); const partes = [u.subarray(0, 8)]; let i = 8;
        while (i + 12 <= u.length) {
          const n = ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0; const tipo = String.fromCharCode(u[i + 4], u[i + 5], u[i + 6], u[i + 7]);
          const fim = i + 12 + n; if (fim > u.length) return null;
          if (!fora.has(tipo)) partes.push(u.subarray(i, fim));
          i = fim; if (tipo === 'IEND') break;
        }
        return new Blob(partes, { type: 'image/png' });
      }
      if (arquivo.type === 'image/jpeg' && u[0] === 0xff && u[1] === 0xd8) {
        const partes = [u.subarray(0, 2)]; let i = 2;
        while (i + 4 <= u.length) {
          if (u[i] !== 0xff) return null;
          const m = u[i + 1];
          if (m === 0xda) { partes.push(u.subarray(i)); break; } // daqui em diante são os pixels
          const n = (u[i + 2] << 8) | u[i + 3]; const fim = i + 2 + n; if (fim > u.length) return null;
          if (m === 0xe1) { // EXIF: se a foto depende da orientação para ficar em pé, refaz a imagem
            const seg = u.subarray(i + 4, fim); const txt = String.fromCharCode(...seg.subarray(0, 6));
            if (txt === 'Exif\0\0') { const o = orientacao(seg.subarray(6)); if (o && o !== 1) return null; }
          }
          if (!((m >= 0xe1 && m <= 0xef) || m === 0xfe)) partes.push(u.subarray(i, fim));
          i = fim;
        }
        return new Blob(partes, { type: 'image/jpeg' });
      }
      if (arquivo.type === 'image/webp' && String.fromCharCode(...u.subarray(8, 12)) === 'WEBP') { // tira os blocos EXIF e XMP
        const partes = []; let i = 12, vp8x = -1, tam = 4;
        while (i + 8 <= u.length) {
          const id = String.fromCharCode(...u.subarray(i, i + 4)); const n = (u[i + 4] | (u[i + 5] << 8) | (u[i + 6] << 16) | (u[i + 7] << 24)) >>> 0;
          const fim = i + 8 + n + (n & 1); if (i + 8 + n > u.length) return null;
          if (id !== 'EXIF' && id !== 'XMP ') { if (id === 'VP8X') vp8x = partes.length; partes.push(u.slice(i, Math.min(fim, u.length))); tam += Math.min(fim, u.length) - i; }
          i = fim;
        }
        if (vp8x >= 0) partes[vp8x][8] &= ~0x0c; // avisa que não tem mais EXIF/XMP
        const cab = new Uint8Array(12); cab.set(u.subarray(0, 12)); new DataView(cab.buffer).setUint32(4, tam, true);
        return new Blob([cab, ...partes], { type: 'image/webp' });
      }
      if (arquivo.type === 'image/bmp') return arquivo;
      return null;
    } catch (e) { return null; }
  }
  function orientacao(t) {
    if (t.length < 8) return 0;
    const le = t[0] === 0x49; const r16 = (o) => (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
    const r32 = (o) => (le ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3])) >>> 0;
    const ifd = r32(4); if (ifd + 2 > t.length) return 0;
    const n = r16(ifd);
    for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (e + 12 > t.length) return 0; if (r16(e) === 0x0112) return r16(e + 8); }
    return 1;
  }

  // Imagem: (0.8.3) vai na qualidade ORIGINAL sempre que cabe no limite (antes toda imagem era refeita em WebP 86% e até 1600 px, e as
  // prints com texto ficavam borradas). Só se passar do limite ela é comprimida, primeiro sem mudar o tamanho e em qualidade alta.
  // GIF animado vai como está (se couber).
  async function comprimir(arquivo, limite) {
    if (!/^image\//.test(arquivo.type)) return arquivo;
    if (arquivo.type === 'image/gif' && arquivo.size <= limite) return arquivo;
    if (arquivo.size <= limite) { const limpo = await semMetadados(arquivo); if (limpo) return limpo; }
    const bmp = await createImageBitmap(arquivo).catch(() => null);
    if (!bmp) return null;
    const maior = Math.max(bmp.width, bmp.height);
    for (const lado of [maior, 3840, 2560, 1920, 1600]) {
      if (lado > maior) continue;
      const esc = lado / maior;
      const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * esc); cv.height = Math.round(bmp.height * esc);
      const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, cv.width, cv.height);
      for (const [tipo, q] of [['image/webp', 0.95], ['image/webp', 0.9], ['image/jpeg', 0.9]]) {
        const b = await new Promise((ok) => cv.toBlob(ok, tipo, q));
        if (b && b.size <= limite) return b;
      }
    }
    return null;
  }

  // (0.8.3) rascunho de cada conversa (o texto e os prints deixados no campo): sair da conversa e voltar traz tudo de volta, sem colar de
  // novo. Fica só na memória (nada vai para o disco): fechar o app limpa
  const RASCUNHOS = new Map();
  function criar(o) {
    const U = A.ui;
    const limiteDe = () => (typeof o.limite === 'function' ? o.limite() : o.limite) || 1500 * 1024; // (0.7.14) muda com o Aero Bubble
    const aceitar = o.aceitar || 'image/*';
    const els = new Map();
    let resp = null, anexos = [], editando = null;
    const MAX_ANEXOS = 20; // (1.0.2) até 20 fotos/vídeos juntos

    const lista = h('div', { class: 'cx-msgs selecionavel', role: 'log', 'aria-live': 'polite' });
    // (0.8.6) várias ligações seguidas viram uma linha só (a mais nova), com "+N" para ver as outras: nada de encher o chat de avisos
    const pilhasAbertas = new Set();
    let rafPilha = 0;
    const empilharLigacoes = () => {
      rafPilha = 0;
      let run = [];
      const fechar = () => {
        if (run.length > 1) {
          const ult = run[run.length - 1], chave = run[0].dataset.id, aberta = pilhasAbertas.has(chave);
          run.forEach((el, i) => { el.classList.toggle('cx-sis-escondida', i < run.length - 1 && !aberta); el.classList.toggle('cx-sis-aberta', i < run.length - 1 && aberta); });
          let b = ult.querySelector(':scope > .cx-sis-mais');
          if (!b) { b = h('button', { type: 'button', class: 'cx-sis-mais' }); ult.append(b); }
          b.textContent = aberta ? T('esconder', 'hide') : '+' + (run.length - 1);
          b.title = aberta ? T('Juntar as ligações de novo', 'Stack the calls again') : T('Ver as outras ', 'See the other ') + (run.length - 1) + T(' ligações', ' calls');
          b.onclick = (e) => { e.stopPropagation(); if (pilhasAbertas.has(chave)) pilhasAbertas.delete(chave); else pilhasAbertas.add(chave); empilharLigacoes(); };
        } else run.forEach((el) => { el.classList.remove('cx-sis-escondida', 'cx-sis-aberta'); const b = el.querySelector(':scope > .cx-sis-mais'); if (b) b.remove(); });
        run = [];
      };
      for (const el of lista.children) { if (el.classList.contains('cx-sis')) run.push(el); else fechar(); }
      fechar();
    };
    new MutationObserver(() => { if (!rafPilha) rafPilha = requestAnimationFrame(empilharLigacoes); }).observe(lista, { childList: true });
    // (0.7.1) a bolha das mídias do tamanho da mídia: com o limite de altura, a imagem/vídeo encolhia, mas a bolha (o "fundo") ficava com a
    // largura original e sobrava um vão do lado. Ao carregar, a mídia ganha a largura exata que cabe no limite de altura
    const MIDIA_W = 362, MIDIA_H = { IMG: 320, VIDEO: 300 };
    const ajustarMidia = (ev) => {
      const el = ev.target; if (!el || !(el.tagName === 'IMG' || el.tagName === 'VIDEO') || !el.closest('.cx-midia')) return;
      const nw = el.naturalWidth || el.videoWidth, nh = el.naturalHeight || el.videoHeight; if (!nw || !nh) return;
      const sid = el.dataset.sid || (el.closest('[data-sid]') || {}).dataset?.sid; if (sid && !DIMS.has(sid)) { DIMS.set(sid, [nw, nh]); if (DIMS.size > 3000) DIMS.delete(DIMS.keys().next().value); }
      if (el.closest('.cx-gcel, .cx-tw-topo, .cx-yt')) return; // (0.9.6) na grade (e no post do X / capa do YouTube) quem manda é a célula: a largura fixa esticava a foto (o "zoom")
      // o limite de largura é o da caixa de dentro (GIF 300, imagem 320): passando dele, a imagem encolhia e a bolha não
      // (0.7.3) o GIF tem altura máxima de 260 (não 320): com 320 a conta dava uma largura maior que a do GIF na tela, e a bolha sobrava
      const gif = !!el.closest('.cx-gif-quadro'), lim = gif ? 300 : el.closest('.cx-img') ? 320 : MIDIA_W, alt = gif ? 260 : MIDIA_H[el.tagName];
      const w = Math.round(Math.min(lim, nw, (nw * alt) / nh));
      el.style.width = w + 'px'; el.style.height = 'auto';
      if (el.tagName === 'IMG' && !el.dataset.anim && !el.dataset.leve && el.closest('.cx-img:not(.cx-gif)')) aliviar(el, w);
    };
    // (0.8.5) imagem enorme (2K, 4K) no chat: o navegador guardava cada uma inteira na memória e, rolando, tinha que abrir de novo as que
    // saíam da memória (era o engasgo). Agora, depois de carregar, a imagem da conversa vira uma cópia exatamente do tamanho em que ela
    // aparece na tela (contando a densidade da tela, então fica igual de nítida), feita fora da tela principal, uma por vez e sem pressa.
    // Abrir, baixar, copiar e encaminhar continuam usando a original
    const leves = new Map(), filaLeve = []; let leveRodando = false;
    const ocioso = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 60)));
    function aliviar(img, w) {
      const nw = img.naturalWidth, nh = img.naturalHeight, lw = Math.round(w * Math.min(3, Math.max(1, devicePixelRatio || 1)));
      if (!nw || !nh || nw < lw * 1.4 || nw * nh < 1200000 || typeof OffscreenCanvas === 'undefined') return;
      img.dataset.leve = '1';
      filaLeve.push([img, img.currentSrc || img.src, lw, Math.max(1, Math.round((lw * nh) / nw))]);
      if (!leveRodando) rodarLeves();
    }
    async function rodarLeves() {
      leveRodando = true;
      while (filaLeve.length) {
        await ocioso();
        const [img, src, lw, lh] = filaLeve.shift();
        if (!img.isConnected || (img.currentSrc || img.src) !== src) continue;
        let u = leves.get(src);
        if (!u) {
          try {
            const b = await (await fetch(src)).blob(); // blob: (conversa cifrada) ou do servidor: vem do cache
            const bmp = await createImageBitmap(b, { resizeWidth: lw, resizeHeight: lh, resizeQuality: 'high' });
            const cv = new OffscreenCanvas(lw, lh); cv.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
            u = URL.createObjectURL(await cv.convertToBlob({ type: 'image/webp', quality: 0.97 }));
            leves.set(src, u);
          } catch (e) { A.log && A.log.aviso && A.log.aviso('chat: cópia leve da imagem', String(e && e.message || e)); continue; }
        }
        const pre = new Image(); pre.src = u; try { await pre.decode(); } catch (_) { continue; }
        if (img.isConnected && (img.currentSrc || img.src) === src) img.src = u; // mesmo tamanho na tela: nada pula
      }
      leveRodando = false;
    }
    lista.addEventListener('load', ajustarMidia, true); lista.addEventListener('loadedmetadata', ajustarMidia, true);
    // a imagem que já tinha carregado antes de entrar no chat (do cache) não dispara "load" aqui: ajusta quando ela entra
    // (0.8.3) só olha o que ENTROU (antes procurava as mídias da conversa inteira a cada mudança, até ao passar o mouse numa mensagem:
    // quanto mais mensagens antigas carregadas, mais pesado ficava)
    let rafMidia = 0; const entraram = new Set();
    new MutationObserver((muts) => {
      for (const mu of muts) for (const n of mu.addedNodes) if (n.nodeType === 1 && (n.matches('.cx-midia img, .cx-midia video') || n.querySelector('.cx-midia img, .cx-midia video'))) entraram.add(n);
      if (rafMidia || !entraram.size) return;
      rafMidia = requestAnimationFrame(() => {
        rafMidia = 0; const lote = [...entraram]; entraram.clear();
        for (const n of lote) for (const el of (n.matches('img, video') ? [n] : n.querySelectorAll('.cx-midia img, .cx-midia video'))) if (!el.style.width && (el.naturalWidth || el.videoWidth)) ajustarMidia({ target: el });
      });
    }).observe(lista, { childList: true, subtree: true });
    const inp = h('textarea', { class: 'campo cx-inp', rows: 1, placeholder: o.placeholder || T('Escreva uma mensagem...', 'Write a message...'), maxlength: 2000, autocomplete: 'off' });
    const respBar = h('div', { class: 'cx-resp', hidden: true });
    const anexoBar = h('div', { class: 'cx-anexo', hidden: true });
    const arquivo = h('input', aceitar.split(',').some((t) => t.trim() === '*') ? { type: 'file', hidden: true } : { type: 'file', accept: aceitar, hidden: true });
    const emojiPainel = h('div', { class: 'cx-emojis vidro', hidden: true, role: 'dialog', 'aria-label': 'Emojis' });
    const btnEmoji = U.btn('', { icone: 'emoji', tipo: 'sec', redondo: true, peq: true, titulo: T('Emojis', 'Emojis'), onclick: () => alternarEmojis() });
    const btnAnexo = U.btn('', { icone: 'clipe', tipo: 'sec', redondo: true, peq: true, titulo: o.tituloAnexo || T('Enviar imagem (ou cole / arraste)', 'Send an image (or paste / drag)'), onclick: () => arquivo.click() });
    const btnGif = o.gifs ? U.btn('', { icone: 'gif', tipo: 'sec', redondo: true, peq: true, titulo: 'GIFs', onclick: () => alternarEmojis(null, 'gif') }) : null;
    const btnFig = o.figurinhas ? U.btn('', { icone: 'figurinha', tipo: 'sec', redondo: true, peq: true, titulo: T('Figurinhas', 'Stickers'), onclick: () => alternarEmojis(null, 'fig') }) : null;
    const btnGravar = o.gravarAudio ? U.btn('', { icone: 'mic', tipo: 'sec', redondo: true, peq: true, titulo: T('Gravar mensagem de voz', 'Record a voice message'), onclick: () => gravador() }) : null;
    // (1.0.2) botão direito (ou segurar, no celular) no microfone: entrada, sensibilidade, supressão de ruído e cancelamento de eco das mensagens de voz
    const cfgGrav = () => { const c = A.cfg.v.chat = A.cfg.v.chat || {}; c.grav = { dev: '', sens: 100, sup: true, eco: true, ...(c.grav || {}) }; return c.grav; };
    if (btnGravar) btnGravar.addEventListener('contextmenu', async (e) => {
      e.preventDefault(); e.stopPropagation();
      const g = cfgGrav(), salvar = () => A.cfg.salvar();
      const { entradas } = A.mic && A.mic.dispositivos ? await A.mic.dispositivos() : { entradas: [] };
      const marca = (sim) => (sim ? 'check' : null);
      const ev = { clientX: e.clientX, clientY: e.clientY, target: btnGravar, ancora: btnGravar };
      U.menuContexto(ev, [
        { texto: T('Entrada', 'Input'), icone: 'mic', sub: [{ texto: T('Padrão do sistema', 'System default'), icone: marca(!g.dev), onclick: () => { g.dev = ''; salvar(); } },
          ...entradas.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => ({ texto: (d.label || T('Microfone ', 'Microphone ') + (i + 1)).slice(0, 48), icone: marca(g.dev === d.deviceId), onclick: () => { g.dev = d.deviceId; salvar(); } }))] },
        { texto: T('Sensibilidade', 'Sensitivity') + (g.sens >= 100 ? T(' · sempre aberto', ' · always open') : ' · ' + g.sens + '%'), icone: 'sinal', onclick: () => sensibilidade() },
        null,
        { texto: T('Supressão de ruído', 'Noise suppression') + (g.sup ? T(' · ligada', ' · on') : T(' · desligada', ' · off')), icone: marca(g.sup) || 'micOff', onclick: () => { g.sup = !g.sup; salvar(); } },
        { texto: T('Cancelamento de eco', 'Echo cancellation') + (g.eco ? T(' · ligado', ' · on') : T(' · desligado', ' · off')), icone: marca(g.eco) || 'fones', onclick: () => { g.eco = !g.eco; salvar(); } },
      ]);
    });
    function sensibilidade() {
      const g = cfgGrav();
      const val = h('span', { class: 'peq suave' }), sl = h('input', { type: 'range', min: 0, max: 100, step: 1, value: g.sens, class: 'gs-slider', 'aria-label': T('Sensibilidade', 'Sensitivity') });
      const pintar = () => { val.textContent = sl.value >= 100 ? T('Sempre aberto: grava tudo', 'Always open: records everything') : T('Só grava acima de ', 'Only records above ') + sl.value + '%'; };
      sl.addEventListener('input', () => { g.sens = +sl.value; pintar(); A.cfg.salvar(); }); pintar();
      U.popover(btnGravar, [h('div', { class: 'peq suave' }, T('Mais à esquerda: só a voz mais alta entra na gravação. No fim: grava tudo.', 'Further left: only louder voice gets recorded. At the end: records everything.')), sl, val], { largura: 300, titulo: T('Sensibilidade do microfone', 'Microphone sensitivity') });
    }
    const sugestoes = h('div', { class: 'cx-sugestoes vidro', hidden: true, role: 'listbox' });
    const btnEnviar = U.btn('', { icone: 'enviar', redondo: true, peq: true, titulo: T('Enviar', 'Send'), onclick: () => enviar() });
    // "Fulano está digitando…" (como no Discord): quem usa o chat avisa (o.digitando) e mostra o dos outros (digitando(nomes))
    const digitandoEl = h('div', { class: 'cx-digitando', 'aria-live': 'polite' });
    let ultimoAviso = 0, semente = Math.floor(Math.random() * 1e9); // (0.8.6) muda a cada mensagem enviada: sorteia o texto/emojis do indicador
    inp.addEventListener('input', () => { if (!o.digitando || !inp.value.trim()) return; const agora = Date.now(); if (agora - ultimoAviso > 2500) { ultimoAviso = agora; o.digitando(semente); } });
    const quemDigita = new Map(); // nome -> até quando
    const dgDe = new Map(); // (0.8.3) nome -> o indicador personalizado dela ({ e: emojis, a: animação, t: texto })
    let timerDig = 0;
    function pintarDigitando() {
      const agora = Date.now();
      for (const [n, ate] of quemDigita) if (ate < agora) quemDigita.delete(n);
      const nomes = [...quemDigita.keys()];
      // (0.8.3) as bolinhas são as mesmas o tempo todo (antes eram refeitas a cada segundo e a animação recomeçava no meio); só o texto muda
      // (0.8.3) uma pessoa só digitando, com indicador próprio: os emojis dela (com a animação) e o texto dela no lugar do "está digitando…"
      const dg = nomes.length === 1 ? dgDe.get(nomes[0]) : null, meu = !!(dg && ((dg.e && dg.e.length) || dg.t));
      const txt = !nomes.length ? '' : (nomes.length > 3 ? T('Várias pessoas', 'Several people') : nomes.join(', ')) + '\u0000' + (meu && dg.t ? ' ' + dg.t : nomes.length === 1 || nomes.length > 3 ? T(' está digitando…', ' is typing…') : T(' estão digitando…', ' are typing…'));
      const modo = meu && dg.e && dg.e.length ? 'e:' + dg.a + ':' + dg.e.join('|') : 'pontos';
      if (txt && (digitandoEl.dataset.txt !== txt || digitandoEl.dataset.modo !== modo)) {
        if (!digitandoEl.firstChild || digitandoEl.dataset.modo !== modo) {
          const icone = modo === 'pontos' ? h('span', { class: 'cx-dig-pontos' }, h('i'), h('i'), h('i')) : h('span', { class: 'cx-dig-emojis anim-' + (dg.a || 'nenhuma') }, ...dg.e.map((e) => h('i', {}, e)));
          digitandoEl.replaceChildren(icone, h('span', {})); digitandoEl.dataset.modo = modo;
        }
        const [quem, resto] = txt.split('\u0000'); digitandoEl.lastChild.replaceChildren(h('b', {}, quem), resto);
        digitandoEl.dataset.txt = txt;
      }
      digitandoEl.classList.toggle('on', nomes.length > 0);
      clearTimeout(timerDig); if (nomes.length) timerDig = setTimeout(pintarDigitando, 1000);
    }
    const digitando = (nome, dg) => { quemDigita.set(nome, Date.now() + 4000); if (dg && typeof dg === 'object') dgDe.set(nome, dg); else dgDe.delete(nome); pintarDigitando(); };
    const parouDeDigitar = (nome) => { quemDigita.delete(nome); pintarDigitando(); }; // a mensagem dele chegou
    // (0.8.0) chat estreito (a janelinha da conversa, o chat da sala): os botões de anexo, GIF, figurinha, emoji e voz ficam dentro do
    // "+" (abre uma fileira em cima da caixa de texto), para sobrar espaço para ler o que você escreve. No chat largo ficam todos à mostra.
    const extras = h('div', { class: 'cx-extras' }, btnAnexo, btnGif, btnFig, btnEmoji, btnGravar);
    const btnMais = U.btn('', { icone: 'mais', tipo: 'sec', redondo: true, peq: true, titulo: T('Mais opções (anexo, GIF, figurinha, emoji, voz)', 'More (attachment, GIF, sticker, emoji, voice)'), onclick: () => abrirExtras() });
    btnMais.classList.add('cx-mais'); btnMais.setAttribute('aria-expanded', 'false');
    const foraExtras = (e) => { if (!extras.contains(e.target) && !btnMais.contains(e.target)) abrirExtras(false); };
    function abrirExtras(sim = !compositor.classList.contains('extras-abertos')) {
      compositor.classList.toggle('extras-abertos', sim); btnMais.setAttribute('aria-expanded', String(sim));
      if (sim) document.addEventListener('pointerdown', foraExtras, true); else document.removeEventListener('pointerdown', foraExtras, true);
    }
    extras.addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(() => abrirExtras(false), 0); }); // escolheu: a fileira fecha
    const linha = h('div', { class: 'cx-linha' }, btnMais, extras, h('span', { class: 'cx-prompt', 'aria-hidden': 'true' }, '>'), inp, btnEnviar);
    const compositor = h('div', { class: 'cx-compor', 'data-area': 'compor' }, digitandoEl, respBar, anexoBar, sugestoes, linha, emojiPainel, arquivo);
    // (0.9.1) longe do fim (pulou para uma mensagem antiga ou subiu muito): o botão de voltar para as mensagens recentes
    const btnPresente = h('button', { type: 'button', class: 'cx-presente', hidden: true, onclick: () => irAoPresente() }, h('span', {}, T('Ver mensagens recentes', 'Jump to present')), A.icone('chevron', 14));
    const el = h('div', { class: 'cx' }, lista, h('div', { class: 'cx-presente-lugar' }, btnPresente), compositor);
    // (0.8.0) o campo de escrever segue a SUA bolha (o mesmo modelo e as mesmas cores): no Terminal ele vira o prompt com o cursor
    // piscando, e o que você envia aparece como a saída do terminal
    const minhaBolha = () => { const bc = A.api && A.api.eu ? A.api.eu.bc : null; A.ui.aplicarBolha(compositor, bc && bc.m && bc.m !== 'padrao' ? bc : null); if (bc && bc.m && bc.m !== 'padrao' && !compositor.style.getPropertyValue('--bcf')) { const d = A.ui.CORES_BOLHA[bc.m]; if (d) compositor.style.setProperty('--bcf', d[1]); } }; // (0.9.0) a letra do campo na cor do modelo (antes ficava a do tema e sumia no fundo da bolha)
    // (0.9.1) a letra do campo sempre legível: mede a cor de verdade do fundo do campo (por cima do vidro e do tema) e, se a cor da letra da
    // bolha some nele, troca pela que dá mais contraste (clara ou escura). Bolha clara com letra escura num campo escuro deixava o texto sumido
    const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const rgbDe = (txt) => { const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/.exec(txt || ''); if (!m) return null; let a = m[4] == null ? 1 : parseFloat(m[4]); if (String(m[4]).endsWith('%')) a /= 100; return [+m[1], +m[2], +m[3], a]; };
    const contraste = (a, b) => { const x = Math.max(a, b), y = Math.min(a, b); return (x + 0.05) / (y + 0.05); };
    function letraDoCampo() {
      inp.style.removeProperty('--bcf-campo');
      if (!compositor.dataset.bc || !inp.isConnected) return;
      const cs = getComputedStyle(inp), fundoTema = document.documentElement.dataset.tema === 'escuro' ? [24, 30, 38] : [235, 242, 248];
      // o gradiente (aero, sabão...) conta pela cor do meio; a cor de fundo por cima do tema, com a transparência dela
      const grad = /gradient/.test(cs.backgroundImage) ? (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(rgbDe).filter(Boolean) : [];
      let c = grad.length ? grad[Math.floor(grad.length / 2)] : rgbDe(cs.backgroundColor);
      if (!c) return;
      const mix = (k) => Math.round(c[k] * c[3] + fundoTema[k] * (1 - c[3]));
      const lf = lum(mix(0), mix(1), mix(2)), t = rgbDe(cs.color); if (!t) return;
      const lt = lum(t[0], t[1], t[2]);
      if (contraste(lf, lt) >= 3.2) return;
      inp.style.setProperty('--bcf-campo', contraste(lf, 1) >= contraste(lf, lum(16, 32, 44)) ? '#ffffff' : '#10202c');
    }
    minhaBolha();
    requestAnimationFrame(() => requestAnimationFrame(letraDoCampo)); inp.addEventListener("focus", () => { if (!inp.style.getPropertyValue("--bcf-campo")) letraDoCampo(); });
    A.evt.vivo(el, 'perfil', () => { if (!el.isConnected) return; minhaBolha(); requestAnimationFrame(letraDoCampo); });
    A.evt.vivo(el, 'tema', () => { if (el.isConnected) requestAnimationFrame(letraDoCampo); });

    // ---------- painel de GIFs, figurinhas e emojis (0.6.0, como no Discord, com a cara do Aero) ----------
    let emojisMontados = false, abaPainel = 'emoji';
    const corpoPainel = h('div', { class: 'cx-painel-corpo' });
    function montarEmojis() {
      emojisMontados = true;
      const topo = h('div', { class: 'cx-painel-topo seg' });
      const abasP = [o.gifs ? ['gif', 'GIFs'] : null, o.figurinhas ? ['fig', T('Figurinhas', 'Stickers')] : null, ['emoji', 'Emoji']].filter(Boolean);
      for (const [id, rot] of abasP) topo.append(h('button', { type: 'button', dados: { aba: id }, onclick: () => mostrarAba(id) }, rot));
      if (abasP.length > 1) emojiPainel.append(topo);
      emojiPainel.append(corpoPainel);
    }
    function mostrarAba(id) {
      abaPainel = id; corpoPainel.textContent = '';
      emojiPainel.querySelectorAll('.cx-painel-topo button').forEach((b) => b.classList.toggle('sel', b.dataset.aba === id));
      if (id === 'gif') painelGifs(); else if (id === 'fig') painelFigurinhas(); else painelEmojis();
    }
    // (0.7.12) a fileira de categorias rola de lado também com a roda do mouse (sem isso a última categoria ficava escondida para quem não tem touchpad)
    const abasDeLado = (abas) => abas.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || abas.scrollWidth <= abas.clientWidth) return; e.preventDefault(); abas.scrollLeft += e.deltaY; }, { passive: false });
    function painelEmojis() { if (A.extras && A.extras.secaoEmojis && A.api.token) corpoPainel.append(A.extras.secaoEmojis((t) => { inserir(t); A.som.tocar('bolha'); })); corpoPainel.append(gradeEmojis({ aoEscolher: (e) => { inserir(e); A.som.tocar('bolha'); } })); } // (1.0.0) + os seus emojis
    function painelGifs() {
      const busca = h('input', { class: 'campo cx-gif-busca', placeholder: T('Procurar GIFs no Klipy', 'Search Klipy GIFs'), 'aria-label': T('Procurar GIFs', 'Search GIFs') });
      const grade = h('div', { class: 'cx-gif-grade' });
      // (0.6.0) a estrela ao lado da busca mostra os favoritos (0.7.3: só ali)
      let soFavs = false;
      const btnFavs = h('button', { type: 'button', class: 'cx-gif-favs', title: T('GIFs favoritos', 'Favorite GIFs'), 'aria-pressed': 'false', onclick: () => { soFavs = !soFavs; btnFavs.classList.toggle('on', soFavs); btnFavs.setAttribute('aria-pressed', String(soFavs)); busca.placeholder = soFavs ? T('Procurar nos seus favoritos', 'Search your favorites') : T('Procurar GIFs no Klipy', 'Search Klipy GIFs'); termo = busca.value.trim(); carregar(true); } }, A.icone('estrela', 16));
      corpoPainel.append(h('div', { class: 'cx-gif-topo' }, busca, btnFavs), grade);
      let serie = 0, pag = 1, termo = '', mais = false, carregando = false;
      const tile = (g, fav) => {
        const est = h('button', { type: 'button', class: 'cx-gif-fav' + (fav ? ' on' : ''), title: fav ? T('Tirar dos favoritos', 'Remove from favorites') : T('Adicionar aos favoritos', 'Add to favorites'), onclick: async (e) => { e.stopPropagation(); await o.gifs.favoritar(g, !est.classList.contains('on')); est.classList.toggle('on'); } }, A.icone('estrela', 15));
        // (0.6.1) cada GIF na proporção dele (a caixa já nasce do tamanho certo, sem pular quando a imagem carrega)
        const prop = g.w > 0 && g.h > 0 ? A.limitar(g.h / g.w, 0.4, 2.2) : 0.75;
        const b = h('button', { type: 'button', class: 'cx-gif-it', title: g.titulo || 'GIF', estilo: { 'aspect-ratio': String(1 / prop) }, onclick: () => { alternarEmojis(false); if (inp.value.trim()) { const a = inp.selectionStart ?? inp.value.length, antes = inp.value.slice(0, a), depois = inp.value.slice(inp.selectionEnd ?? a); inserir((antes && !/\s$/.test(antes) ? ' ' : '') + g.url + (depois && !/^\s/.test(depois) ? ' ' : '')); guardarRascunho(); inp.focus(); return; } /* (1.0.2) escrevendo: o GIF entra onde está o cursor */ const r = resp; responder(null); o.enviar({ texto: g.url, resp: r }).catch((er) => U.toast(er.message, { tipo: 'erro' })); } }, h('img', { src: g.prev, alt: g.titulo || 'GIF', loading: 'lazy', draggable: 'false' }), est);
        b.addEventListener('contextmenu', (e) => menuMidia(e, { url: g.url, tipo: 'gif' }));
        b.prop = prop;
        return b;
      };
      // (0.6.1) mosaico em 2 colunas (como no Tenor): cada GIF entra na coluna mais baixa. Antes era uma grade de caixas iguais e os
      // GIFs se espremiam e passavam um por cima do outro
      const secao = (titulo) => {
        const cols = [h('div', { class: 'cx-gif-col' }), h('div', { class: 'cx-gif-col' })], alt = [0, 0];
        if (titulo) grade.append(h('div', { class: 'cx-emoji-tit' }, titulo));
        grade.append(h('div', { class: 'cx-gif-cols' }, ...cols));
        return (b) => { const i = alt[0] <= alt[1] ? 0 : 1; cols[i].append(b); alt[i] += b.prop + 0.03; };
      };
      let principal = null;
      const carregar = async (novo) => {
        if (carregando && !novo) return;
        const n = ++serie; carregando = true;
        if (novo) { pag = 1; grade.textContent = ''; principal = null; }
        try {
          if (soFavs) {
            const todos = await o.gifs.favoritos(); if (n !== serie) return;
            // (0.8.5) procurar DENTRO dos favoritos: só os que você guardou (pelo nome do GIF e pelas palavras do endereço)
            const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const palavras = norm(termo).split(/\s+/).filter(Boolean);
            const texto = (g) => { let u = g.url || ''; try { u = decodeURIComponent(u); } catch (e) { /* ok */ } return norm((g.titulo || '') + ' ' + u.replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')); };
            const favs = palavras.length ? todos.filter((g) => { const t = texto(g); return palavras.every((p) => t.includes(p)); }) : todos;
            mais = false; const por = secao(''); favs.forEach((g) => por(tile(g, true)));
            if (!todos.length) grade.append(h('p', { class: 'peq suave' }, T('Nenhum favorito ainda. Toque na estrela de um GIF para guardar aqui.', 'No favorites yet. Tap the star on a GIF to keep it here.')));
            else if (!favs.length) grade.append(h('p', { class: 'peq suave' }, T('Nenhum dos seus favoritos combina com essa busca.', 'None of your favorites match this search.')));
            carregando = false; return;
          }
          // (0.7.3) os favoritos ficam só na estrela: a lista normal mostra só os GIFs do Klipy
          const r = await o.gifs.buscar(termo, pag);
          if (n !== serie) return;
          const favs = new Set((await o.gifs.favoritos()).map((g) => g.url));
          if (!principal) principal = secao('');
          r.gifs.forEach((g) => principal(tile(g, favs.has(g.url)))); mais = r.mais; pag++;
          if (!grade.querySelector('.cx-gif-it')) grade.append(h('p', { class: 'peq suave' }, T('Nenhum GIF encontrado.', 'No GIFs found.')));
        } catch (e) { if (n === serie) grade.append(h('p', { class: 'peq suave' }, e.message || T('Não deu para buscar GIFs agora.', 'Could not search GIFs now.'))); }
        carregando = false;
      };
      let t = 0; busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { termo = busca.value.trim(); carregar(true); }, soFavs ? 120 : 350); }); // (0.8.5) com a estrela ligada, a busca fica dentro dos favoritos
      busca.addEventListener('keydown', (e) => e.stopPropagation());
      grade.addEventListener('scroll', () => { if (mais && grade.scrollTop + grade.clientHeight > grade.scrollHeight - 200) carregar(false); }, { passive: true });
      carregar(true); setTimeout(() => busca.focus({ preventScroll: true }), 30);
    }
    function painelFigurinhas() {
      const grade = h('div', { class: 'cx-fig-grade' });
      const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
      const novo = h('button', { type: 'button', class: 'cx-fig cx-fig-nova', title: T('Criar figurinha (PNG, JPG ou GIF)', 'Create sticker (PNG, JPG or GIF)'), onclick: () => arq.click() }, A.icone('mais', 28));
      arq.addEventListener('change', async () => { const f = arq.files[0]; arq.value = ''; if (!f) return; try { await o.figurinhas.criar(f); A.som.tocar('sucesso'); pintar(); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } });
      const F = o.figurinhas, src = (cod, id) => `${A.api.servidor}/api/figurinha/${cod}/${id}`;
      const mandar = (cod, id) => { alternarEmojis(false); const r = resp; responder(null); o.enviar({ texto: `<fig:${cod}:${id}>`, resp: r }).catch((er) => U.toast(er.message, { tipo: 'erro' })); }; // (0.9.7) também responde
      // (0.8.5) a estrela no canto de cada figurinha: guarda (ou tira) das favoritas
      const estrela = (cod, id) => F.favoritar ? h('button', { type: 'button', class: 'cx-gif-fav cx-fig-fav' + (F.eFavorita(cod, id) ? ' on' : ''), title: F.eFavorita(cod, id) ? T('Tirar das favoritas', 'Remove from favorites') : T('Favoritar figurinha', 'Favorite sticker'), onclick: async (e) => { e.stopPropagation(); try { await F.favoritar(cod, id, !F.eFavorita(cod, id)); pintar(); } catch (er) { U.toast(er.message, { tipo: 'erro' }); } } }, A.icone('estrela', 15)) : null;
      // (1.0.2) busca pelo nome (dá para dar nome a qualquer uma no botão direito) e as seções recolhem (fica guardado)
      const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const busca = h('input', { class: 'campo cx-gif-busca', placeholder: T('Procurar figurinha pelo nome', 'Search stickers by name'), 'aria-label': T('Procurar figurinhas', 'Search stickers') });
      busca.addEventListener('keydown', (e) => e.stopPropagation());
      busca.addEventListener('input', () => filtrar());
      const nomear = async (cod, f) => {
        const campo = h('input', { class: 'campo', value: f.n || '', maxlength: 40, autocomplete: 'off', placeholder: T('ex.: gato rindo', 'e.g. laughing cat') });
        const ok = await U.confirmar(h('div', { class: 'col', estilo: { gap: '8px' } }, h('p', { estilo: { margin: 0 } }, T('Nome para achar na busca', 'Name to find it in search')), campo), { sim: T('Salvar', 'Save'), titulo: T('Nome da figurinha', 'Sticker name') });
        if (!ok) return; try { await F.nomear(cod, f.id, campo.value.trim()); pintar(); } catch (er) { U.toast(er.message, { tipo: 'erro' }); }
      };
      let secoes = [];
      const filtrar = () => {
        const q = norm(busca.value);
        for (const s of secoes) { let vis = 0; for (const b of s.itens) { const ok = !q || norm(b.dataset.n).includes(q); b.hidden = !ok || (s.rec && !q); if (ok) vis++; } s.tit.hidden = !!q && !vis; }
      };
      const secao = (k, texto, qtd) => { const s = { itens: [], rec: false }; s.tit = U.tituloRecolhe(k, texto, (rec) => { s.rec = rec; filtrar(); }, h('small', { class: 'suave' }, String(qtd))); secoes.push(s); grade.append(s.tit); return s; };
      const pintar = async () => {
        try {
          const [{ lista, codigo }, favs] = await Promise.all([F.listar(), F.favoritas ? F.favoritas().catch(() => []) : []]);
          grade.textContent = ''; secoes = [];
          if (favs.length) {
            const s = secao('fig-fav', T('Favoritas', 'Favorites'), favs.length);
            for (const f of favs) {
              const b = h('button', { type: 'button', class: 'cx-fig', title: f.n || '', dados: { n: f.n || '' }, onclick: () => mandar(f.c, f.id) }, h('img', { src: src(f.c, f.id), alt: f.n || '', loading: 'lazy', draggable: 'false' }), estrela(f.c, f.id));
              b.addEventListener('contextmenu', (e) => U.menuContexto(e, [{ texto: T('Dar um nome', 'Name it'), icone: 'lapis', onclick: () => nomear(f.c, f) }, { texto: T('Tirar das favoritas', 'Remove from favorites'), icone: 'estrela', onclick: async () => { await F.favoritar(f.c, f.id, false).catch(() => {}); pintar(); } }]));
              s.itens.push(b); grade.append(b);
            }
          }
          const s = secao('fig-suas', T('Suas figurinhas', 'Your stickers'), lista.length);
          grade.append(novo, arq); s.itens.push(novo); novo.dataset.n = '';
          for (const f of lista) {
            const b = h('button', { type: 'button', class: 'cx-fig', title: f.n || '', dados: { n: f.n || '' }, onclick: () => mandar(codigo, f.id) }, h('img', { src: src(codigo, f.id), alt: f.n || '', loading: 'lazy', draggable: 'false' }), estrela(codigo, f.id));
            b.addEventListener('contextmenu', (e) => U.menuContexto(e, [{ texto: T('Dar um nome', 'Name it'), icone: 'lapis', onclick: () => nomear('', f) }, { texto: T('Apagar figurinha', 'Delete sticker'), icone: 'lixo', perigo: true, onclick: async () => { if (await U.confirmar(T('Apagar esta figurinha?', 'Delete this sticker?'), { perigo: true })) { await F.apagar(f.id).catch((er) => U.toast(er.message, { tipo: 'erro' })); pintar(); } } }]));
            s.itens.push(b); grade.append(b);
          }
          if (!lista.length) { const p = h('p', { class: 'peq suave', dados: { n: '' } }, T('Crie a sua primeira figurinha com o +. Todas ficam do mesmo tamanho.', 'Create your first sticker with +. They all end up the same size.')); s.itens.push(p); grade.append(p); }
          filtrar();
        } catch (e) { grade.textContent = ''; grade.append(novo, arq, h('p', { class: 'peq suave' }, e.message)); }
      };
      corpoPainel.append(h('div', { class: 'cx-gif-topo' }, busca), grade); pintar();
    }
    // clique fora fecha o painel; o ouvinte só existe enquanto ele está aberto (cada chat criado não deixa nada pendurado no documento)
    const foraEmojis = (e) => { if (!emojiPainel.contains(e.target) && ![btnEmoji, btnGif, btnFig].some((b) => b && b.contains(e.target))) alternarEmojis(false); };
    // (0.7.2) o painel abre EM CIMA do botão que você apertou (GIF, figurinha ou emoji), alinhado pela direita dele; antes abria lá na
    // esquerda, longe dos botões
    function ancorarPainel(aba) {
      const b = { gif: btnGif, fig: btnFig, emoji: btnEmoji }[aba] || btnEmoji; if (!b) return;
      const rc = compositor.getBoundingClientRect(), rb = b.getBoundingClientRect(), w = emojiPainel.offsetWidth;
      const direita = Math.max(8, Math.min(rc.right - rb.right - 6, rc.width - w - 8));
      Object.assign(emojiPainel.style, { left: 'auto', right: direita + 'px' });
    }
    function alternarEmojis(forcar, aba) {
      if (aba && !emojiPainel.hidden && abaPainel !== aba) { mostrarAba(aba); ancorarPainel(aba); return; }
      const abrir = forcar != null ? forcar : emojiPainel.hidden;
      if (abrir === !emojiPainel.hidden) return;
      if (abrir && !emojisMontados) montarEmojis();
      if (abrir) mostrarAba(aba || 'emoji');
      emojiPainel.hidden = !abrir; A.som.tocar(abrir ? 'abrir' : 'fechar');
      if (abrir) ancorarPainel(aba || 'emoji');
      if (abrir) document.addEventListener('pointerdown', foraEmojis, true); else document.removeEventListener('pointerdown', foraEmojis, true);
      if (abrir) { const b = emojiPainel.querySelector('.cx-emoji'); if (b && document.documentElement.dataset.entrada === 'pad') b.focus({ preventScroll: true }); }
    }
    function inserir(txt) {
      const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? inp.value.length;
      inp.value = inp.value.slice(0, a) + txt + inp.value.slice(b);
      const p = a + txt.length; try { inp.setSelectionRange(p, p); } catch (e) { /* ok */ }
      autoAltura();
    }

    // ---------- anexos: arquivo, colar, arrastar ----------
    async function escolherArquivo(f) {
      if (!f) return;
      const ok = aceitar.split(',').some((t) => (t.trim() === '*' ? true : t.trim() === 'texto' ? !!(A.codigo && A.codigo.ehTexto(f.name, f.type) && !/^(image|audio|video)\//.test(f.type)) : t.endsWith('/*') ? f.type.startsWith(t.slice(0, -1)) : f.type === t.trim()));
      if (!ok) { U.toast(T('Esse tipo de arquivo não pode ser enviado aqui.', 'That file type cannot be sent here.'), { tipo: 'erro' }); return; }
      let b = f; const limite = limiteDe();
      if (/^image\//.test(f.type) && o.comprimirImagens !== false) b = await comprimir(f, limite);
      if (!b || b.size > limite) { U.toast(T('Arquivo grande demais (máximo ', 'File too large (max ') + Math.round(limite / 1024 / 1024 * 10) / 10 + ' MB).' + (o.dicaLimite ? ' ' + o.dicaLimite() : ''), { tipo: 'erro' }); return; }
      if (anexos.length >= MAX_ANEXOS) { U.toast(T('No máximo ' + MAX_ANEXOS + ' arquivos por vez.', 'At most ' + MAX_ANEXOS + ' files at a time.'), { tipo: 'erro' }); return; }
      b.nome = f.name || 'imagem'; anexos.push(b); pintarAnexos(); guardarRascunho();
      inp.focus({ preventScroll: true });
    }
    // (0.8.3) vários anexos de uma vez (colar um print, depois outro...): ficam empilhados em cima do campo, cada um com o seu X
    const urlsPrev = new Map();
    function pintarAnexos() {
      anexoBar.textContent = ''; anexoBar.hidden = !anexos.length;
      for (const [b, u] of urlsPrev) if (!anexos.includes(b)) { URL.revokeObjectURL(u); urlsPrev.delete(b); }
      anexos.forEach((b) => {
        if (!urlsPrev.has(b)) urlsPrev.set(b, URL.createObjectURL(b));
        const url = urlsPrev.get(b);
        // (1.0.2) foto ou vídeo: clicar abre a prévia em tamanho grande (com as outras fotos/vídeos do envio para passar de lado)
        const verPrevia = (e) => { e.stopPropagation(); const midias = anexos.filter((x) => /^(image|video)\//.test(x.type)).map((x) => ({ url: urlsPrev.get(x) || (urlsPrev.set(x, URL.createObjectURL(x)), urlsPrev.get(x)), nome: x.nome || x.name, video: /^video\//.test(x.type) })); U.verImagem(url, { nome: b.nome || b.name, galeria: { itens: midias } }); };
        const prev = /^image\//.test(b.type) ? h('img', { src: url, alt: '', class: 'cx-anexo-ver', title: T('Ver antes de enviar', 'Preview before sending'), onclick: verPrevia }) : /^video\//.test(b.type) ? h('video', { src: url, muted: '', class: 'cx-anexo-ver', title: T('Ver antes de enviar', 'Preview before sending'), onclick: verPrevia }) : h('span', { class: 'cx-anexo-ic' }, A.icone(A.codigo && A.codigo.ehTexto(b.nome, b.type) ? 'codigo' : /^audio\//.test(b.type) || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)$/i.test(b.nome || '') ? 'musica' : 'clipe', 22));
        anexoBar.append(h('div', { class: 'cx-anexo-it', title: b.nome + ' · ' + Math.max(1, Math.round(b.size / 1024)) + ' KB' }, prev, anexos.length === 1 ? h('span', { class: 'peq' }, b.nome, ' · ', Math.max(1, Math.round(b.size / 1024)) + ' KB') : null,
          U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Tirar anexo', 'Remove attachment'), onclick: () => { anexos = anexos.filter((x) => x !== b); pintarAnexos(); guardarRascunho(); } })));
      });
      anexoBar.classList.toggle('varios', anexos.length > 1);
    }
    const guardarRascunho = () => { if (!o.rascunho) return; if (inp.value || anexos.length) RASCUNHOS.set(o.rascunho, { texto: inp.value, anexos: anexos.slice() }); else RASCUNHOS.delete(o.rascunho); };
    arquivo.multiple = true;
    arquivo.addEventListener('change', async () => { const fs = [...arquivo.files]; arquivo.value = ''; for (const f of fs) await escolherArquivo(f); });
    inp.addEventListener('paste', async (e) => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) { e.preventDefault(); for (const f of fs) await escolherArquivo(f); } });
    let arrastando = 0;
    el.addEventListener('dragenter', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); arrastando++; el.classList.add('soltar'); } });
    el.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    el.addEventListener('dragleave', () => { if (--arrastando <= 0) { arrastando = 0; el.classList.remove('soltar'); } });
    el.addEventListener('drop', async (e) => { e.preventDefault(); arrastando = 0; el.classList.remove('soltar'); for (const f of [...e.dataTransfer.files]) await escolherArquivo(f); });

    // ---------- gravador de mensagem de voz (0.6.0) ----------
    // Bolhas sobem de acordo com a sua voz (um canvas só, desenhado só enquanto grava). Pausar/retomar, parar e ouvir (com a barra para
    // ir a qualquer trecho), regravar, descartar ou enviar. Até 2 minutos (cabe nos 10 MB).
    let gravando = null;
    async function gravador() {
      if (gravando) return;
      // (0.6.0) sem o ganho automático do navegador (era ele que deixava os áudios estourados) e com um limitador suave antes de gravar
      const gc = cfgGrav();
      let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: gc.eco !== false, noiseSuppression: gc.sup !== false, autoGainControl: false, ...(gc.dev ? { deviceId: { ideal: gc.dev } } : {}) } }); } catch (e) { U.toast(T('Não consegui usar o microfone.', 'Could not use the microphone.'), { tipo: 'erro' }); return; }
      const tipo = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const ctx = A.som.destravar() || new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 256; const src = ctx.createMediaStreamSource(st); src.connect(an);
      const ganho = ctx.createGain(); ganho.gain.value = 0.8;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -14; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.003; lim.release.value = 0.2;
      const saida = ctx.createMediaStreamDestination(); src.connect(ganho); ganho.connect(lim); lim.connect(saida);
      const dados = new Uint8Array(an.frequencyBinCount);
      // (0.6.0) o canvas acompanha o tamanho real na tela (antes era 360x44 esticado pela barra: as bolhas ficavam achatadas)
      const cv = h('canvas', { class: 'gv-canvas', width: 360, height: 44 }), g = cv.getContext('2d');
      let W = 360, H = 44;
      const medir = () => { const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 360, hh = cv.clientHeight || 44; if (w !== W || hh !== H || cv.width !== Math.round(w * dpr)) { W = w; H = hh; cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); } g.setTransform(dpr, 0, 0, dpr, 0, 0); };
      const tempoEl = h('span', { class: 'gv-tempo' }, '0:00');
      let partes = [], rec = null, ms = 0, t0 = 0, raf = 0, bolhas = [], blob = null, url = '';
      const cor = getComputedStyle(document.documentElement).getPropertyValue('--cor-2').trim() || '#7fd3ff';
      const desenhar = (agora) => {
        raf = requestAnimationFrame(desenhar);
        an.getByteTimeDomainData(dados); let pico = 0; for (const v of dados) pico = Math.max(pico, Math.abs(v - 128)); const nivel = Math.min(1, pico / 60);
        if (gc.sens < 100) { const abre = nivel * 100 >= (100 - gc.sens) * 0.6; ganho.gain.setTargetAtTime(abre ? 0.8 : 0, ctx.currentTime, abre ? 0.01 : 0.25); } // (1.0.2) sensibilidade: abaixo do limite, silêncio
        medir();
        if (Math.random() < 0.15 + nivel * 0.9 && bolhas.length < 40) bolhas.push({ x: 8 + Math.random() * (W - 16), y: H + 6, r: 3 + nivel * 8 + Math.random() * 2, v: 0.35 + nivel * 1.2 + Math.random() * 0.35, a: 0.9 });
        g.clearRect(0, 0, W, H);
        for (const b of bolhas) {
          b.y -= b.v; b.x += Math.sin((agora / 300) + b.r) * 0.3; b.a -= 0.008;
          g.globalAlpha = Math.max(0, b.a); g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.283); g.fillStyle = cor; g.globalAlpha *= 0.35; g.fill(); g.globalAlpha = Math.max(0, b.a); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
          g.beginPath(); g.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, 6.283); g.fillStyle = '#fff'; g.fill();
        }
        g.globalAlpha = 1; bolhas = bolhas.filter((b) => b.y + b.r > 0 && b.a > 0);
        const total = ms + (rec && rec.state === 'recording' ? performance.now() - t0 : 0);
        tempoEl.textContent = Math.floor(total / 60000) + ':' + String(Math.floor(total / 1000) % 60).padStart(2, '0');
        if (total > 120000 && rec && rec.state === 'recording') parar();
      };
      const barraG = h('div', { class: 'gv' });
      const sair = () => { cancelAnimationFrame(raf); st.getTracks().forEach((t) => t.stop()); try { src.disconnect(); ganho.disconnect(); lim.disconnect(); } catch (e) { /* ok */ } if (url) URL.revokeObjectURL(url); gravando = null; barraG.remove(); linha.hidden = false; inp.focus({ preventScroll: true }); };
      const btn = (ic, tit, f, tipoB = 'sec') => U.btn('', { icone: ic, tipo: tipoB, redondo: true, peq: true, titulo: tit, onclick: f });
      const comecar = () => {
        partes = []; ms = 0; blob = null; if (url) { URL.revokeObjectURL(url); url = ''; }
        rec = new MediaRecorder(saida.stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 48000 } : {}); rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
        rec.start(250); t0 = performance.now(); A.som.tocar('mic-on'); modoGravando();
        cancelAnimationFrame(raf); raf = requestAnimationFrame(desenhar);
      };
      const pausar = () => { if (!rec) return; if (rec.state === 'recording') { rec.pause(); ms += performance.now() - t0; cancelAnimationFrame(raf); raf = 0; } else if (rec.state === 'paused') { rec.resume(); t0 = performance.now(); raf = requestAnimationFrame(desenhar); } modoGravando(); };
      const parar = () => new Promise((ok) => { if (!rec || rec.state === 'inactive') return ok(); if (rec.state === 'recording') ms += performance.now() - t0; rec.onstop = () => { cancelAnimationFrame(raf); raf = 0; blob = new Blob(partes, { type: (tipo || 'audio/webm').split(';')[0] }); url = URL.createObjectURL(blob); modoOuvir(); ok(); }; rec.stop(); A.som.tocar('mic-off'); });
      const enviarAudio = async () => { await parar(); if (!blob || ms < 600) { U.toast(T('Gravação curta demais.', 'Recording too short.')); return; } const f = new File([blob], T('áudio', 'voice') + (tipo.includes('mp4') ? '.m4a' : '.webm'), { type: blob.type }); sair(); try { await o.enviar({ texto: '', anexo: Object.assign(f, { nome: f.name }) }); } catch (e) { U.toast(e.message, { tipo: 'erro' }); } };
      function modoGravando() {
        const pausado = rec && rec.state === 'paused';
        barraG.replaceChildren(btn('lixo', T('Descartar', 'Discard'), sair), h('span', { class: 'gv-ponto' + (pausado ? ' pausado' : '') }), cv, tempoEl,
          btn(pausado ? 'mic' : 'pausa', pausado ? T('Continuar gravando', 'Resume') : T('Pausar', 'Pause'), pausar), btn('parar', T('Parar e ouvir', 'Stop and listen'), () => parar()), btn('enviar', T('Enviar', 'Send'), enviarAudio, ''));
      }
      function modoOuvir() {
        const audio = h('audio', { src: url, preload: 'auto' });
        const { barra, t } = barraDe(audio);
        barraG.replaceChildren(btn('lixo', T('Descartar', 'Discard'), sair), audio, botaoPlay(audio), barra, t, controleVolume(audio), btn('atualizar', T('Regravar', 'Record again'), () => { audio.pause(); comecar(); }), btn('enviar', T('Enviar', 'Send'), enviarAudio, ''));
      }
      gravando = { sair }; linha.hidden = true; linha.after(barraG); comecar();
    }

    // ---------- (0.8.7) arrastar uma mensagem: para a esquerda responde, para a direita encaminha (mouse e toque) ----------
    // No mouse, começar em cima do texto continua selecionando o texto (o arraste vale no resto da mensagem: o balão, a foto, o espaço do lado).
    // No toque, segurar parado abre o menu da mensagem. Clicar duas vezes numa mensagem sua abre a edição rápida.
    {
      let arr = null;
      const LIM = 64;
      const NAO = '.mp-barra, input, textarea, button, a, video, audio, iframe, .cx-yt, .cx-midia, .cx-reacoes, .cx-acoes, .cx-codigo, [contenteditable]';
      lista.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; arr = null;
        const el2 = e.target.closest && e.target.closest('.cx-msg'); if (!el2 || !lista.contains(el2)) return;
        // (0.9.7) a figurinha também arrasta (responder/encaminhar); o clique continua abrindo. (1.0.0) toda a área da mensagem de figurinha
        // arrasta (como GIF e texto), não só em cima da imagem; a estrela de favoritar continua sendo só um botão
        const naMidia = e.target.closest('.so-figurinha') && !e.target.closest('button');
        if (!naMidia && e.target.closest(NAO)) return;
        if (!naMidia && e.pointerType === 'mouse' && e.target.closest('.cx-txt, .cx-cab b, .cx-resp')) return;
        const x = els.get(el2.dataset.id) || els.get(+el2.dataset.id); if (!x || !x.m || x.m.sistema || x.m.pendente) return;
        const a0 = arr = { el: el2, m: x.m, id: e.pointerId, toque: e.pointerType !== 'mouse', x0: e.clientX, y0: e.clientY, dx: 0, decidido: null, ic: null, lado: 0 };
        if (a0.toque) a0.segurarT = setTimeout(() => { if (arr === a0 && a0.decidido === null) { arr = null; try { navigator.vibrate && navigator.vibrate(15); } catch (_) { /* ok */ } menuMsg({ preventDefault() {}, clientX: a0.x0, clientY: a0.y0 }, a0.m); } }, 520);
      });
      lista.addEventListener('pointermove', (e) => {
        const a = arr; if (!a || e.pointerId !== a.id) return;
        const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
        if (a.decidido === null && Math.abs(dx) + Math.abs(dy) > 10) {
          clearTimeout(a.segurarT);
          const horiz = Math.abs(dx) > Math.abs(dy) * 1.4, pode = dx < 0 || !!(o.encaminhar && !a.m.trancada);
          a.decidido = horiz && pode;
          if (!a.decidido) { arr = null; return; }
          try { a.el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
          if (!a.toque) { const sel = getSelection(); if (sel) sel.removeAllRanges(); }
          a.el.classList.add('arrastando');
        }
        if (!a.decidido) return;
        if (e.cancelable) e.preventDefault();
        const max = o.encaminhar && !a.m.trancada ? 96 : 0;
        a.dx = Math.max(-96, Math.min(max, dx));
        const lado = a.dx < 0 ? -1 : a.dx > 0 ? 1 : 0;
        if (lado !== a.lado) {
          a.lado = lado; if (a.ic) { a.ic.remove(); a.ic = null; }
          if (lado) { a.ic = h('span', { class: 'cx-arr-ic ' + (lado < 0 ? 'resp' : 'enc'), 'aria-hidden': 'true' }, A.icone(lado < 0 ? 'responder' : 'encaminhar', 18)); a.el.append(a.ic); }
        }
        a.el.style.transform = `translateX(${a.dx}px)`;
        const pronto = Math.abs(a.dx) >= LIM;
        if (a.ic) { a.ic.classList.toggle('pronto', pronto); a.ic.style.opacity = String(Math.min(1, Math.abs(a.dx) / LIM)); }
        if (pronto && !a.vibrou) { a.vibrou = true; try { navigator.vibrate && navigator.vibrate(12); } catch (_) { /* ok */ } A.som.tocar('bolha'); }
        if (!pronto) a.vibrou = false;
      }, { passive: false });
      const soltar = (e) => {
        const a = arr; if (!a || (e && e.pointerId !== a.id)) return; arr = null; clearTimeout(a.segurarT);
        if (!a.decidido) return;
        a.el.classList.remove('arrastando'); a.el.classList.add('voltando'); a.el.style.transform = ''; setTimeout(() => a.el.classList.remove('voltando'), 300);
        if (a.ic) { const ic = a.ic; ic.style.opacity = '0'; setTimeout(() => ic.remove(), 250); }
        // o clique que vem logo depois de soltar não abre nada (foto, perfil...)
        const engole = (c) => { c.stopPropagation(); c.preventDefault(); }; a.el.addEventListener('click', engole, { capture: true, once: true }); setTimeout(() => a.el.removeEventListener('click', engole, { capture: true }), 80);
        if (a.dx <= -LIM) responder(a.m);
        else if (a.dx >= LIM && o.encaminhar) o.encaminhar(a.m);
      };
      lista.addEventListener('pointerup', soltar); lista.addEventListener('pointercancel', soltar);
      lista.addEventListener('dblclick', (e) => {
        const el2 = e.target.closest && e.target.closest('.cx-msg'); if (!el2 || e.target.closest('a, button, input, textarea, video, audio, iframe, .cx-midia, .cx-editar, .cx-reacoes')) return;
        const x = els.get(el2.dataset.id) || els.get(+el2.dataset.id); if (!x || !x.m) return;
        const m = x.m; if (!o.ehMeu(m) || m.texto == null || !o.editar || m.pendente || m.sistema) return;
        const sel = getSelection(); if (sel) sel.removeAllRanges();
        editar(m);
      });
    }

    // ---------- menções (0.6.0): "@" abre a lista de quem está na conversa; no envio "@Nome" vira "<@CODIGO>" ----------
    const marcados = new Map(); // "@Nome" escrito -> código
    let sugIdx = 0, sugLista = [];
    function pintarSugestoes() {
      const pos = inp.selectionStart || 0, antes = inp.value.slice(0, pos), m = /(^|\s)@([^\s@]{0,24})$/.exec(antes);
      if (!m) { const me = /(^|\s):([\p{L}\p{N}_+-]{2,24})$/u.exec(antes); if (me) { pintarEmojisSug(me[2].toLowerCase(), antes); return; } }
      if (!m || !o.membros) { sugestoes.hidden = true; return; }
      const q = m[2].toLowerCase();
      // (0.6.9) num grupo, "@todos" e "@aqui" aparecem primeiro
      const membros = o.membros();
      const especiais = membros.length > 2 ? [{ especial: 'todos', nome: 'todos', desc: T('Todo mundo da conversa', 'Everyone in the chat') }, { especial: 'aqui', nome: 'aqui', desc: T('Quem está online', 'Everyone online') }].filter((x) => x.nome.startsWith(q)) : [];
      sugLista = [...especiais, ...membros.filter((p) => !A.api.eu || p.codigo !== A.api.eu.codigo).filter((p) => (p.nome || '').toLowerCase().includes(q) || (p.tag || '').toLowerCase().includes(q))].slice(0, 8);
      if (!sugLista.length) { sugestoes.hidden = true; return; }
      sugIdx = Math.min(sugIdx, sugLista.length - 1); sugestoes.textContent = '';
      sugLista.forEach((p, i) => sugestoes.append(h('button', { type: 'button', class: 'cx-sug' + (i === sugIdx ? ' sel' : ''), onpointerdown: (e) => { e.preventDefault(); escolherMencao(p); } }, p.especial ? h('span', { class: 'cx-sug-todos' }, '@') : U.avatar(p, 24), h('b', {}, p.especial ? '@' + p.nome : p.nome), p.especial ? h('span', { class: 'suave peq' }, p.desc) : p.tag ? h('span', { class: 'suave peq' }, '#' + p.tag) : null)));
      sugestoes.hidden = false;
    }
    // (1.0.2) ":" + o começo do nome abre os emojis (português ou inglês, e os seus emojis criados); Enter/Tab ou clicar coloca no texto
    const normal = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    function pintarEmojisSug(q, antes) {
      carregarNomes().then((nomes) => {
        if (inp.value.slice(0, inp.selectionStart || 0) !== antes) return; // já mudou
        const qn = normal(q), lista = [];
        const ec = A.extras && A.extras.emojisCache ? A.extras.emojisCache() : null;
        if (ec && ec.emojis) for (const e of ec.emojis) if (e.n.includes(qn)) lista.push({ custom: e, cod: ec.codigo, nome: e.n, pont: e.n.startsWith(qn) ? 0 : 1 });
        for (const [em, txt] of Object.entries(nomes || {})) {
          const pals = normal(txt).split(' '); let pont = -1;
          for (let i = 0; i < pals.length; i++) if (pals[i].startsWith(qn)) { pont = (pals[i] === qn ? 0 : 1) + Math.min(i, 8) / 10; break; }
          if (pont >= 0) lista.push({ emoji: em, nome: txt.split(' ').slice(0, 7).join(' '), pont: pont + 0.5 });
          if (lista.length > 200) break;
        }
        lista.sort((a, b) => a.pont - b.pont);
        sugLista = lista.slice(0, 8);
        if (!sugLista.length) { sugestoes.hidden = true; return; }
        sugIdx = Math.min(sugIdx, sugLista.length - 1); sugestoes.textContent = '';
        sugLista.forEach((x, i) => sugestoes.append(h('button', { type: 'button', class: 'cx-sug cx-sug-emoji' + (i === sugIdx ? ' sel' : ''), onpointerdown: (e) => { e.preventDefault(); escolherSug(x); } },
          x.custom ? h('img', { class: 'cx-sug-em', src: A.extras.emojis.url(x.cod, x.custom.id), alt: '' }) : h('span', { class: 'cx-sug-em' }, x.emoji), h('span', { class: 'cx-sug-nome', title: x.nome }, x.custom ? ':' + x.nome + ':' : x.nome))));
        sugestoes.hidden = false;
      });
    }
    function escolherSug(x) {
      if (!x.emoji && !x.custom) return escolherMencao(x);
      const pos = inp.selectionStart || 0, antes = inp.value.slice(0, pos), me = /(^|\s):([\p{L}\p{N}_+-]{2,24})$/u.exec(antes); if (!me) return;
      const ini = pos - me[2].length - 1, txt = (x.custom ? ':' + x.custom.n + ':' : x.emoji) + ' ';
      inp.value = inp.value.slice(0, ini) + txt + inp.value.slice(pos);
      const np = ini + txt.length; inp.setSelectionRange(np, np);
      if (x.emoji && A.chat && A.chat.usouEmoji) A.chat.usouEmoji(x.emoji);
      sugestoes.hidden = true; autoAltura(); guardarRascunho(); A.som.tocar('bolha');
    }
    function escolherMencao(p) {
      const pos = inp.selectionStart || 0, antes = inp.value.slice(0, pos), m = /(^|\s)@([^\s@]{0,24})$/.exec(antes); if (!m) return;
      const ini = pos - m[2].length - 1, txt = '@' + p.nome + ' ';
      inp.value = inp.value.slice(0, ini) + txt + inp.value.slice(pos);
      const np = ini + txt.length; inp.setSelectionRange(np, np); marcados.set('@' + p.nome, p.especial || p.codigo);
      sugestoes.hidden = true; autoAltura(); A.som.tocar('bolha');
    }
    inp.addEventListener('input', () => { sugIdx = 0; pintarSugestoes(); });
    inp.addEventListener('input', (e) => { // (1.0.2) conversões: troca na hora, quando a "palavra" termina com espaço
      if (!(A.cfg.v.chat && A.cfg.v.chat.conversoes === true) || e.inputType !== 'insertText' || e.data !== ' ') return;
      const pos = inp.selectionStart || 0, antes = inp.value.slice(0, pos - 1), mm = /(^|\s)(\S{2,4})$/.exec(antes); if (!mm || !MAPA_CONV.has(mm[2])) return;
      const ini = antes.length - mm[2].length, em = MAPA_CONV.get(mm[2]);
      inp.value = inp.value.slice(0, ini) + em + inp.value.slice(antes.length); const np = ini + em.length + 1; inp.setSelectionRange(np, np); autoAltura(); guardarRascunho();
    });
    inp.addEventListener('blur', () => setTimeout(() => { sugestoes.hidden = true; }, 120));
    const comMencoes = (t) => { let r = t; for (const [nome, cod] of [...marcados].sort((x, y) => y[0].length - x[0].length)) r = r.split(nome).join('<@' + cod + '>'); return r; };

    // ---------- escrever / enviar ----------
    const sozinha = window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'); // (0.8.3) o CSS já cresce a caixa: nada de medir a cada tecla
    const autoAltura = () => { if (sozinha) return; inp.style.height = 'auto'; if (!inp.value) { inp.style.height = ''; inp.classList.remove('rola'); return; } inp.style.height = Math.min(140, inp.scrollHeight) + 'px'; // (0.7.14) vazio: a altura de uma linha (o Chromium contava o texto de exemplo quebrado)
    inp.classList.toggle('rola', inp.scrollHeight > 140); };
    inp.addEventListener('input', autoAltura);
    inp.addEventListener('input', guardarRascunho);
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation(); // atalhos da sala (C, M, F...) não disparam enquanto escreve
      if (!sugestoes.hidden && sugLista.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + sugLista.length) % sugLista.length; pintarSugestoes(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolherSug(sugLista[sugIdx]); return; }
        if (e.key === 'Escape') { sugestoes.hidden = true; return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
      else if (e.key === 'Escape') { if (resp) responder(null); else if (!emojiPainel.hidden) alternarEmojis(false); else inp.blur(); }
      else if (e.key === 'ArrowUp' && !inp.value) { const minha = [...els.values()].reverse().find((x) => o.ehMeu(x.m) && !x.m.img); if (minha) { e.preventDefault(); editar(minha.m); } }
    });
    let enviando = false;
    // (0.8.3) como no Discord: com anexo, o campo fica livre na hora (a mensagem aparece no chat "enviando" e sobe em segundo plano);
    // vários anexos viram uma mensagem cada, o texto vai junto do primeiro
    async function enviar() {
      let texto = comMencoes(A.extras && A.extras.trocarEmojis ? A.extras.trocarEmojis(converterTexto(inp.value.trim())) : converterTexto(inp.value.trim())); // (1.0.0) :nome: dos seus emojis vira o emoji
      if ((!texto && !anexos.length) || enviando) return;
      if (texto && A.idiomas && A.cfg.v.chat && A.cfg.v.chat.minhasPara) { enviando = true; try { texto = await A.idiomas.antesDeEnviar(texto); } finally { enviando = false; } } // (1.0.2) traduz o que você escreveu, se escolheu
      const lista0 = anexos.slice(), resp0 = resp, bruto = inp.value;
      if (lista0.length) {
        inp.value = ''; semente = Math.floor(Math.random() * 1e9); ultimoAviso = 0; marcados.clear(); autoAltura(); responder(null); anexos = []; pintarAnexos(); guardarRascunho(); if (!emojiPainel.hidden) alternarEmojis(false);
        inp.focus({ preventScroll: true });
        try {
          // (0.9.5) fotos e vídeos anexados juntos vão numa mensagem só (viram a grade); os outros arquivos, um por mensagem
          const ehMidia = (b) => /^(image|video)\//.test(b.type || '');
          const juntas = o.multiAnexo ? lista0.filter(ehMidia) : [], resto = juntas.length > 1 ? lista0.filter((b) => !ehMidia(b)) : lista0;
          const envios = (juntas.length > 1 ? [{ anexos: juntas }] : []).concat(resto.map((b) => ({ anexo: b })));
          for (let i = 0; i < envios.length; i++) await o.enviar({ texto: i === 0 ? texto : '', ...envios[i], resp: i === 0 ? resp0 : null, segundoPlano: true });
        } catch (e) {
          U.toast(e.message || String(e), { tipo: 'erro' });
          if (!inp.value && !anexos.length) { inp.value = bruto; anexos = lista0; pintarAnexos(); autoAltura(); guardarRascunho(); } // não perde o que você escreveu
        }
        return;
      }
      enviando = true; btnEnviar.disabled = true;
      try {
        await o.enviar({ texto, resp });
        inp.value = ''; semente = Math.floor(Math.random() * 1e9); ultimoAviso = 0; marcados.clear(); autoAltura(); responder(null); guardarRascunho(); if (!emojiPainel.hidden) alternarEmojis(false);
      } catch (e) { U.toast(e.message || String(e), { tipo: 'erro' }); }
      enviando = false; btnEnviar.disabled = false; inp.focus({ preventScroll: true });
    }
    function responder(m) {
      resp = m; respBar.textContent = ''; respBar.hidden = !m;
      if (!m) return;
      respBar.append(A.icone('responder', 16), h('span', { class: 'cx-resp-txt' }, T('Respondendo a ', 'Replying to '), h('b', {}, o.nome(m)), ': ', ...resumoTrecho(m.texto ? m.texto.slice(0, 120) : '', !!m.anexo)),
        U.btn('', { icone: 'fechar', tipo: 'sec', redondo: true, peq: true, titulo: T('Cancelar resposta', 'Cancel reply'), onclick: () => responder(null) }));
      inp.focus({ preventScroll: true });
    }

    // ---------- mensagens ----------
    function editar(m) {
      const x = els.get(m.id); if (!x) return;
      if (editando) editando.cancelar();
      const bal = x.el.querySelector('.cx-txt'); if (!bal) return;
      const ed = h('textarea', { class: 'campo cx-editar', maxlength: 2000 }, m.texto || '');
      ed.value = m.texto || '';
      const fim = (salvar) => {
        editando = null; ed.replaceWith(bal);
        if (salvar && ed.value.trim() !== (m.texto || '').trim()) o.editar(m, ed.value.trim()).catch((e) => U.toast(e.message || String(e), { tipo: 'erro' }));
        x.el.focus({ preventScroll: true });
      };
      editando = { cancelar: () => fim(false) };
      ed.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fim(true); } else if (e.key === 'Escape') fim(false); });
      bal.replaceWith(ed); ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length);
      ed.style.height = Math.min(160, ed.scrollHeight + 4) + 'px';
    }
    async function apagar(m) {
      if (await U.confirmar(T('Apagar esta mensagem para todos?', 'Delete this message for everyone?'), { sim: T('Apagar', 'Delete'), perigo: true })) o.apagar(m).catch((e) => U.toast(e.message || String(e), { tipo: 'erro' }));
    }
    // ---------- players do Aero (áudio e vídeo) ----------
    const tempo = (x) => { x = Math.max(0, Math.floor(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
    let tocandoMidia = null; // só uma mídia toca por vez
    function barraDe(midia) {
      const cheio = h('i'), bola = h('b'), barra = h('div', { class: 'mp-barra', role: 'slider', tabindex: '0', 'aria-label': T('Posição', 'Position') }, cheio, bola), agora = h('span', {}, '0:00'), tot = h('span', { class: 'mp-tot' }), t = h('span', { class: 'mp-tempo' }, agora, tot); // (0.9.6) o total à parte: some quando o vídeo é estreito
      const pintar = () => { const p = midia.duration ? midia.currentTime / midia.duration : 0; cheio.style.width = (p * 100).toFixed(2) + '%'; bola.style.left = (p * 100).toFixed(2) + '%'; const a = tempo(midia.currentTime), z = midia.duration && isFinite(midia.duration) ? ' / ' + tempo(midia.duration) : ''; if (agora.textContent !== a) agora.textContent = a; if (tot.textContent !== z) tot.textContent = z; };
      const ir = (e) => { const r = barra.getBoundingClientRect(); if (midia.duration && isFinite(midia.duration)) midia.currentTime = A.limitar((e.clientX - r.left) / r.width, 0, 1) * midia.duration; pintar(); };
      barra.addEventListener('pointerdown', (e) => { e.stopPropagation(); barra.setPointerCapture(e.pointerId); ir(e); const mv = (ev) => ir(ev); barra.addEventListener('pointermove', mv); barra.addEventListener('pointerup', () => barra.removeEventListener('pointermove', mv), { once: true }); });
      barra.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') midia.currentTime += 5; if (e.key === 'ArrowLeft') midia.currentTime -= 5; });
      ['timeupdate', 'loadedmetadata', 'durationchange'].forEach((ev) => midia.addEventListener(ev, pintar));
      return { barra, t };
    }
    function botaoPlay(midia, tam = 18) {
      const b = h('button', { type: 'button', class: 'mp-play', title: T('Tocar', 'Play') }, A.icone('play', tam));
      const pintar = () => { b.replaceChildren(A.icone(midia.paused ? 'play' : 'parar', tam)); b.title = midia.paused ? T('Tocar', 'Play') : T('Pausar', 'Pause'); };
      b.addEventListener('click', (e) => { e.stopPropagation(); if (midia.paused) { if (tocandoMidia && tocandoMidia !== midia) tocandoMidia.pause(); tocandoMidia = midia; midia.play().catch(() => {}); } else midia.pause(); });
      ['play', 'pause', 'ended'].forEach((ev) => midia.addEventListener(ev, pintar));
      return b;
    }
    // (0.5.9-8) volume dos áudios e vídeos: um controle em cada player; vale para todos e fica lembrado
    function controleVolume(midia) {
      const vol = () => { const v = +A.cfg.v.volMidia; return Number.isFinite(v) ? A.limitar(v, 0, 1) : 0.55; };
      midia.volume = vol();
      const r = h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(vol() * 100), class: 'mp-vol', title: T('Volume', 'Volume'), 'aria-label': T('Volume', 'Volume') });
      const ic = h('button', { type: 'button', class: 'mp-vol-ic', title: T('Sem som', 'Mute'), tabindex: '-1' }, A.icone(vol() ? 'volume' : 'mudo', 15));
      const pintar = () => { ic.replaceChildren(A.icone(midia.muted || !midia.volume ? 'mudo' : 'volume', 15)); if (A.ui.pintarRange) A.ui.pintarRange(r); };
      r.addEventListener('pointerdown', (e) => e.stopPropagation()); r.addEventListener('click', (e) => e.stopPropagation());
      r.addEventListener('input', () => { A.cfg.v.volMidia = +r.value / 100; A.cfg.salvar(); midia.muted = false; document.querySelectorAll('.cx audio, .cx video').forEach((m) => { m.volume = A.cfg.v.volMidia; }); document.querySelectorAll('.mp-vol').forEach((x) => { if (x !== r) { x.value = r.value; if (A.ui.pintarRange) A.ui.pintarRange(x); } }); pintar(); });
      // (0.5.9-8) como no Discord: só o ícone fica no player; o controle sobe na vertical ao passar o mouse (no toque, ao tocar no ícone)
      const caixa = h('span', { class: 'mp-vol-caixa' }, r);
      const el = h('span', { class: 'mp-volume' }, caixa, ic);
      ic.addEventListener('click', (e) => { e.stopPropagation(); if (A.plat.toque && !el.classList.contains('aberto')) { el.classList.add('aberto'); const fora = (ev) => { if (!el.contains(ev.target)) { el.classList.remove('aberto'); document.removeEventListener('pointerdown', fora, true); } }; document.addEventListener('pointerdown', fora, true); return; } midia.muted = !midia.muted; pintar(); });
      midia.addEventListener('volumechange', pintar);
      setTimeout(pintar, 0);
      return el;
    }
    function tocadorAudio(url, m) {
      const a = h('audio', { src: url, preload: 'metadata' });
      const { barra, t } = barraDe(a);
      const baixar = h('button', { type: 'button', class: 'mp-vol-ic', title: T('Baixar áudio', 'Download audio'), onclick: (e) => { e.stopPropagation(); U.baixar(url, nomeArquivo(m, 'audio')); } }, A.icone('download', 15));
      const onda = h('span', { class: 'mp-onda' }, A.icone('fones', 16));
      const caixa = h('div', { class: 'mp mp-audio' }, a, botaoPlay(a), onda, barra, t, controleVolume(a), baixar);
      caixa.addEventListener('contextmenu', (e) => menuMidia(e, { url, tipo: 'audio', m }));
      visualizador(a, onda, caixa);
      return caixa;
    }
    // (0.8.6) enquanto o áudio toca, barrinhas que pulam com o som no lugar do fone. Só "escuta" uma cópia do som (captureStream):
    // a saída do áudio continua a mesma de antes (volume, fone escolhido). Sem acesso ao som (ex.: link de fora), as barras ondulam sozinhas
    let ctxViz = null;
    function visualizador(a, onda, caixa) {
      const N = 5, cv = h('canvas', { class: 'mp-viz', width: 40, height: 36, 'aria-hidden': 'true' });
      let an = null, dados = null, raf = 0, tentou = false;
      const cor = () => getComputedStyle(caixa).getPropertyValue('--cor-2').trim() || '#7fd3ff';
      const ligar = () => {
        if (tentou) return; tentou = true;
        try {
          if (!a.captureStream || !(window.AudioContext || window.webkitAudioContext)) return;
          ctxViz = ctxViz || new (window.AudioContext || window.webkitAudioContext)();
          const st = a.captureStream(); if (!st.getAudioTracks().length) { tentou = false; return; }
          an = ctxViz.createAnalyser(); an.fftSize = 64; an.smoothingTimeConstant = 0.7; dados = new Uint8Array(an.frequencyBinCount);
          ctxViz.createMediaStreamSource(st).connect(an); if (ctxViz.state === 'suspended') ctxViz.resume().catch(() => {});
        } catch (e) { an = null; }
      };
      const g = cv.getContext('2d'); let c = '#7fd3ff', alt = new Array(N).fill(0.15);
      const desenhar = (agora) => {
        raf = 0; if (a.paused || !caixa.isConnected) return;
        let soma = 0;
        if (an) { an.getByteFrequencyData(dados); for (const v of dados) soma += v; }
        for (let i = 0; i < N; i++) {
          let v;
          if (an && soma) { const ini = Math.floor((i / N) ** 1.6 * dados.length * 0.7), fim = Math.max(ini + 1, Math.floor(((i + 1) / N) ** 1.6 * dados.length * 0.7)); let x = 0; for (let k = ini; k < fim; k++) x = Math.max(x, dados[k]); v = x / 255; }
          else v = 0.35 + 0.3 * Math.sin(agora / 170 + i * 1.3) * Math.sin(agora / 410 + i);
          alt[i] += (Math.max(0.12, Math.min(1, v)) - alt[i]) * 0.45;
        }
        g.clearRect(0, 0, 40, 36); g.fillStyle = c;
        for (let i = 0; i < N; i++) { const hh = Math.max(4, alt[i] * 30), x = 3 + i * 7.5; g.beginPath(); g.roundRect ? g.roundRect(x, 18 - hh / 2, 4.5, hh, 2.25) : g.rect(x, 18 - hh / 2, 4.5, hh); g.fill(); }
        raf = requestAnimationFrame(desenhar);
      };
      a.addEventListener('playing', () => { ligar(); c = cor(); onda.replaceChildren(cv); onda.classList.add('tocando'); if (!raf) raf = requestAnimationFrame(desenhar); });
      const parar = () => { cancelAnimationFrame(raf); raf = 0; onda.classList.remove('tocando'); onda.replaceChildren(A.icone('fones', 16)); };
      a.addEventListener('pause', parar); a.addEventListener('ended', parar);
    }
    // (0.6.9) anexos do Discord (cdn.discordapp.com / media.discordapp.net) tocam aqui como se tivessem sido enviados no Aero
    function tipoDiscord(u) {
      const mm = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(attachments|ephemeral-attachments)\/\d+\/\d+\/[^?\s]+?\.([a-z0-9]{2,5})(\?[^\s]*)?$/i.exec(u);
      if (!mm) return null; const ext = mm[3].toLowerCase();
      return ext === 'gif' ? 'gif' : /^(png|jpe?g|webp|avif|bmp)$/.test(ext) ? 'imagem' : /^(mp4|webm|mov|m4v|mkv)$/.test(ext) ? 'video' : /^(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/.test(ext) ? 'audio' : null;
    }
    function midiaDiscord(u, tipo, m) {
      if (tipo === 'audio') return U.pelicula(h('div', { class: 'cx-midia cx-midia-audio' }, tocadorAudio(u, m)));
      if (tipo === 'video') return midiaVideo(u, m);
      const img = h('img', { src: u, alt: tipo === 'gif' ? 'GIF' : T('imagem', 'image'), loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', dados: tipo === 'gif' ? { anim: '1' } : {} }); img.addEventListener('load', grudar, { once: true });
      const b = h('button', { type: 'button', class: 'cx-img', tabindex: '-1', title: T('Ver imagem', 'View image'), onclick: () => abrirImagem(u, { gif: tipo === 'gif' }) }, img);
      b.addEventListener('contextmenu', (e) => menuMidia(e, { url: u, tipo: tipo === 'gif' ? 'gif' : 'imagem', m }));
      return U.pelicula(h('div', { class: 'cx-midia' }, b));
    }
    // (0.6.9) vídeo que na verdade é só áudio (um áudio baixado como .mp4/.webm): quando o arquivo mostra que não tem imagem, vira o player de áudio
    function midiaVideo(url, m) {
      const caixa = U.pelicula(h('div', { class: 'cx-midia' }, tocadorVideo(url, m)));
      const v = caixa.querySelector('video');
      if (m.anexo && m.anexo.sid) caixa.dataset.sid = m.anexo.sid;
      const d = dimsDe(m); if (v && d) { const [w] = caixaMidia('VIDEO', false, false, d[0], d[1]); v.style.width = w + 'px'; v.style.height = 'auto'; v.style.aspectRatio = d[0] + ' / ' + d[1]; }
      if (v) v.addEventListener('loadedmetadata', () => { if (!v.videoWidth && !v.videoHeight && caixa.isConnected) { v.pause(); v.removeAttribute('src'); v.load(); caixa.replaceWith(U.pelicula(h('div', { class: 'cx-midia cx-midia-audio' }, tocadorAudio(url, m)))); } }, { once: true });
      return caixa;
    }
    playerAero = tocadorVideo;
    function tocadorVideo(url, m) {
      const v = h('video', { src: url, preload: 'metadata', playsinline: '' });
      v.addEventListener('loadedmetadata', grudar, { once: true });
      const { barra, t } = barraDe(v);
      const grande = h('button', { type: 'button', class: 'mp-grande', title: T('Tocar', 'Play') }, A.icone('play', 34));
      // (0.6.0) janelinha flutuante: o vídeo continua tocando ao trocar de aba, até você fechar (e aí para de vez)
      const pip = h('button', { type: 'button', class: 'mp-play mp-pip', title: T('Janelinha (continua ao trocar de aba)', 'Mini player (keeps playing across tabs)'), onclick: (e) => { e.stopPropagation(); U.janelaVideo(url, v.currentTime, !v.paused); v.pause(); } }, A.icone('pip', 16));
      const caixa = h('div', { class: 'mp mp-video' }, v, grande, h('div', { class: 'mp-ctl' }, botaoPlay(v, 16), barra, t, controleVolume(v), pip, h('button', { type: 'button', class: 'mp-play mp-cheia', title: T('Tela cheia', 'Fullscreen'), onclick: (e) => { e.stopPropagation(); if (document.fullscreenElement) document.exitFullscreen(); else caixa.requestFullscreen().catch(() => {}); } }, A.icone('expandir', 16))));
      caixa.addEventListener('contextmenu', (e) => menuMidia(e, { url, tipo: 'video', m }));
      const alternar = () => { if (v.paused) { if (tocandoMidia && tocandoMidia !== v) tocandoMidia.pause(); tocandoMidia = v; v.play().catch(() => {}); } else v.pause(); };
      grande.addEventListener('click', (e) => { e.stopPropagation(); alternar(); }); v.addEventListener('click', alternar);
      ['play', 'pause', 'ended'].forEach((ev) => v.addEventListener(ev, () => caixa.classList.toggle('tocando', !v.paused)));
      return caixa;
    }
    const nomeArquivo = (m, tipo) => (m && m.anexo && m.anexo.nome) || ('aero-' + tipo + '-' + Date.now() + ({ imagem: '.png', gif: '.gif', audio: '.webm', video: '.mp4' }[tipo] || ''));
    // (0.6.0) a imagem grande: zoom (roda do mouse, pinça, duplo clique ou os botões), arrastar para olhar, baixar e abrir no navegador
    function abrirImagem(url, { gif, m, link } = {}) { U.verImagem(url, { nome: nomeArquivo(m, gif ? 'gif' : 'imagem'), gif, link: link || (m && m.anexo && o.linkAnexo ? o.linkAnexo(m) : null), favoritar: gif && o.favoritarGif ? () => o.favoritarGif(url) : null }); }
    // menus do botão direito (como no Discord, com a cara do Aero)
    function menuMidia(e, { url, tipo, m, link: link0 }) {
      e.preventDefault(); e.stopPropagation();
      const imgEl = e.currentTarget && e.currentTarget.querySelector ? e.currentTarget.querySelector('img') : null;
      const it = [];
      if (tipo === 'imagem' || tipo === 'gif') it.push({ texto: T('Abrir imagem', 'Open image'), icone: 'imagem', onclick: () => abrirImagem(url, { gif: tipo === 'gif', m }) });
      it.push({ texto: T('Abrir no navegador', 'Open in browser'), icone: 'externo', onclick: () => U.abrirFora(url, nomeArquivo(m, tipo)) });
      it.push({ texto: T('Baixar', 'Download'), icone: 'download', onclick: () => U.baixar(url, nomeArquivo(m, tipo)) });
      if (tipo === 'imagem' || tipo === 'gif') it.push({ texto: T('Copiar imagem', 'Copy image'), icone: 'copiar', onclick: () => U.copiarImagem(url, imgEl) });
      // (0.8.3) anexo do chat (blob:): o link do Aero, que colado numa conversa vira a própria imagem/GIF/vídeo
      const link = link0 || (/^https?:/.test(url) ? url : null) || (m && m.anexo && o.linkAnexo ? o.linkAnexo(m) : null);
      if (link) it.push({ texto: tipo === 'gif' ? T('Copiar link do GIF', 'Copy GIF link') : tipo === 'video' ? T('Copiar link do vídeo', 'Copy video link') : tipo === 'imagem' ? T('Copiar link da imagem', 'Copy image link') : T('Copiar link', 'Copy link'), icone: 'link', onclick: () => U.copiar(link) });
      if (tipo === 'gif' && o.favoritarGif) it.push({ texto: o.gifFavorito && o.gifFavorito(url) ? T('Tirar dos favoritos', 'Remove from favorites') : T('Favoritar GIF', 'Favorite GIF'), icone: 'estrela', onclick: () => o.favoritarGif(url) });
      if (m) it.push(null, ...itensMsg(m));
      U.menuContexto(e, it);
    }
    // ---------- (0.7.2) REAÇÕES (como no Discord, com a cara do Aero): bolhinhas com o emoji e quantos reagiram; a sua fica destacada,
    // clicar põe/tira a sua; o mouse por cima diz quem reagiu. "Adicionar reação" abre os emojis rápidos e todos os outros ----------
    const meuCod = () => (o.meuId ? o.meuId() : A.api && A.api.eu ? A.api.eu.codigo : ''); // (0.8.0) na sala, convidado reage pelo id dele
    const RAPIDAS = ['❤️', '✅', '🔥', '😂', '👍', '😮'];
    const recentes = () => { const r = (A.cfg.v.reacoesRecentes || []).filter((x) => typeof x === 'string'); return [...new Set([...r, ...RAPIDAS])].slice(0, 8); };
    const lembrarReacao = (e) => { A.cfg.v.reacoesRecentes = [e, ...(A.cfg.v.reacoesRecentes || []).filter((x) => x !== e)].slice(0, 16); A.cfg.salvar(); };
    function reagir(m, e) { lembrarReacao(e); A.som.tocar('bolha'); Promise.resolve(o.reagir(m, e)).catch((x) => U.toast(x.message || String(x), { tipo: 'erro' })); }
    // (0.8.7) reação que já estava na tela não nasce de novo: só o número muda (com um pulinho)
    const reaVistas = new Map();
    function chipsReacao(m) {
      const eu = meuCod(), caixa = h('div', { class: 'cx-reacoes' });
      const chave = String(m.id != null ? m.id : m.seq), antes = reaVistas.get(chave) || {}, agora = {};
      if (reaVistas.size > 600) reaVistas.delete(reaVistas.keys().next().value);
      Object.entries(m.rea).forEach(([e, quem], i) => {
        if (!quem || !quem.length) return;
        agora[e] = quem.length;
        const nomes = quem.map((c) => (c === eu ? T('você', 'you') : o.nomeDe ? o.nomeDe(c) : c));
        const dica = (nomes.length > 3 ? nomes.slice(0, 3).join(', ') + T(' e mais ', ' and ') + (nomes.length - 3) : nomes.join(', ')) + T(' reagiu com ', ' reacted with ') + e.replace(/^s:/, '✨');
        const sup = e.startsWith('s:'), eVer = sup ? e.slice(2) : e; // (1.0.0) super reação
        const chip = h('button', { type: 'button', class: 'cx-reacao' + (sup ? ' super' : '') + (quem.includes(eu) ? ' minha' : ''), 'aria-label': dica, estilo: { '--i': i }, onclick: (ev) => { ev.stopPropagation(); if (segurou) { segurou = false; return; } reagir(m, e); } }, h('span', { class: 'cx-reacao-e' }, eVer), h('b', {}, String(quem.length)));
        // (0.8.7) passar o mouse: as 5 primeiras pessoas (fotos empilhadas e nomes) e "+N"; segurar: a lista completa de todas as reações
        let segurou = false, tSeg = 0;
        chip.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') dicaReacao(chip, e, quem); });
        chip.addEventListener('pointerleave', () => { fecharDicaReacao(); clearTimeout(tSeg); });
        chip.addEventListener('pointerdown', (ev) => { if (ev.button !== 0) return; segurou = false; clearTimeout(tSeg); tSeg = setTimeout(() => { segurou = true; fecharDicaReacao(); listaReacoes(m, e); }, 480); });
        chip.addEventListener('pointerup', () => clearTimeout(tSeg)); chip.addEventListener('pointercancel', () => clearTimeout(tSeg));
        chip.addEventListener('contextmenu', (ev) => { if (ev.pointerType !== 'mouse' && segurou) ev.preventDefault(); });
        if (e in antes) { chip.classList.add('ja'); if (antes[e] !== quem.length) chip.querySelector('b').classList.add('conta-mudou'); }
        caixa.append(chip);
      });
      reaVistas.delete(chave); reaVistas.set(chave, agora);
      caixa.append(h('button', { type: 'button', class: 'cx-reacao cx-reacao-mais' + (Object.keys(antes).length ? ' ja' : ''), title: T('Adicionar reação', 'Add reaction'), onclick: (ev) => { ev.stopPropagation(); escolherReacao(ev.currentTarget, m); } }, A.icone('emoji', 15)));
      return caixa;
    }
    const pessoaReacao = (cod) => { const eu = meuCod(); let p = null; try { p = o.avatar ? o.avatar({ de: cod }) : null; } catch (e) { /* ok */ }
      return { p: p || { nome: cod }, nome: cod === eu ? T('Você', 'You') : (o.nomeDe ? o.nomeDe(cod) : (p && p.nome) || cod) }; };
    let dicaRea = null;
    function fecharDicaReacao() { if (!dicaRea) return; const d = dicaRea; dicaRea = null; d.classList.add('fechando'); setTimeout(() => d.remove(), 160); }
    function dicaReacao(chip, e, quem) {
      fecharDicaReacao();
      const primeiros = quem.slice(0, 5).map(pessoaReacao), resto = quem.length - primeiros.length;
      const nomes = primeiros.map((x) => x.nome).join(', ') + (resto > 0 ? T(' e mais ', ' and ') + resto : '');
      const d = h('div', { class: 'rea-dica vidro', role: 'tooltip' },
        h('div', { class: 'rea-dica-topo' }, h('span', { class: 'rea-dica-e' }, e.replace(/^s:/, '')), h('div', { class: 'rea-dica-fotos' }, ...primeiros.map((x, i) => { const a = U.avatar(x.p, 26); a.style.setProperty('--k', i); return a; }), resto > 0 ? h('span', { class: 'rea-dica-mais' }, '+' + resto) : null)),
        h('div', { class: 'rea-dica-nomes' }, nomes), h('small', { class: 'suave' }, T('Segure para ver todos', 'Hold to see everyone')));
      document.body.append(d); dicaRea = d;
      const vig = setInterval(() => { if (dicaRea !== d) { clearInterval(vig); return; } if (!chip.isConnected || !chip.matches(':hover')) { clearInterval(vig); fecharDicaReacao(); } }, 400);
      const r = chip.getBoundingClientRect(), w = d.offsetWidth, hh = d.offsetHeight;
      d.style.left = A.limitar(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
      d.style.top = (r.top - hh - 8 < 8 ? r.bottom + 8 : r.top - hh - 8) + 'px';
    }
    function listaReacoes(m, inicial) {
      const rea = Object.entries(m.rea || {}).filter(([, q]) => q && q.length);
      if (!rea.length) return;
      A.som.tocar('pop-abrir');
      const abas = h('div', { class: 'rea-lista-abas', role: 'tablist' }), gente = h('div', { class: 'rea-lista-gente' });
      const mostrar = (e) => {
        abas.querySelectorAll('button').forEach((b) => { const s2 = b.dataset.e === e; b.classList.toggle('sel', s2); b.setAttribute('aria-selected', String(s2)); });
        const q = (rea.find(([x]) => x === e) || [, []])[1];
        gente.replaceChildren(...q.map((cod, i) => { const x = pessoaReacao(cod); return h('div', { class: 'rea-lista-pessoa', estilo: { '--i': Math.min(i, 12) } }, U.avatar(x.p, 32), h('b', {}, x.nome), h('span', { class: 'rea-lista-pe' }, e)); }));
      };
      rea.forEach(([e, q]) => abas.append(h('button', { type: 'button', role: 'tab', dados: { e }, onclick: () => mostrar(e) }, h('span', {}, e.replace(/^s:/, '✨')), h('b', {}, String(q.length)))));
      U.modal(T('Reações', 'Reactions'), h('div', { class: 'rea-lista' }, abas, gente), { largura: 460, classe: 'rea-modal' });
      mostrar(rea.some(([x]) => x === inicial) ? inicial : rea[0][0]);
    }
    function escolherReacao(ancora, m) {
      // (1.0.0) o modo "Super": a reação chega com uma explosão animada para todo mundo da conversa (Donator 3 por dia, Supporter à vontade)
      let superOn = false; const X = A.extras, podeSuper = !!(o.superReacoes && X);
      const rr = (e) => { pop.fechar(); reagir(m, superOn ? 's:' + e : e); };
      const bSuper = podeSuper ? h('button', { type: 'button', class: 'cx-rea-super', 'aria-pressed': 'false', onclick: () => { if (!X.tem(3)) { faixa.replaceChildren(X.faixaPrevia(3)); return; } superOn = !superOn; bSuper.classList.toggle('on', superOn); bSuper.setAttribute('aria-pressed', String(superOn)); } }, '✨ ' + T('Super reação', 'Super reaction'), X.tem(3) ? null : X.selo(3)) : null;
      const faixa = h('div', {});
      const rap = h('div', { class: 'cx-rea-rapidas' }, ...recentes().map((e) => h('button', { type: 'button', class: 'cx-emoji', title: e, onclick: () => rr(e) }, e)));
      const abas = h('div', { class: 'cx-emoji-abas' }), grade = h('div', { class: 'cx-emoji-grade cx-rea-grade' });
      abasDeLado(abas);
      const mostrar = (cat) => {
        grade.textContent = '';
        abas.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.cat === cat));
        const frag = document.createDocumentFragment();
        for (const e of EMOJIS[cat]) frag.append(h('button', { type: 'button', class: 'cx-emoji', title: e, onclick: () => rr(e) }, e));
        grade.append(frag);
      };
      for (const cat of Object.keys(EMOJIS)) abas.append(h('button', { type: 'button', class: 'cx-emoji-aba', dados: { cat }, title: T(...NOMES_CAT[cat]), onclick: () => mostrar(cat) }, cat));
      mostrar(Object.keys(EMOJIS)[0]);
      const pop = U.popover(ancora, h('div', { class: 'col cx-rea-pop' }, bSuper, faixa, rap, abas, grade), { largura: 340, titulo: T('Adicionar reação', 'Add reaction') });
    }
    function itensMsg(m) {
      const meu = o.ehMeu(m), it = [{ texto: T('Responder', 'Reply'), icone: 'responder', onclick: () => responder(m) }];
      if (o.reagir && !m.pendente && !m.trancada) it.unshift({ texto: T('Adicionar reação', 'Add reaction'), icone: 'emoji', onclick: () => { const x = els.get(m.id); escolherReacao(x ? x.el : lista, m); } });
      if (o.encaminhar && !m.pendente && !m.trancada) it.push({ texto: T('Encaminhar', 'Forward'), icone: 'encaminhar', onclick: () => o.encaminhar(m) });
      if (m.texto && !m.trancada && A.idiomas) { // (1.0.2) traduzir e o dicionário (a palavra selecionada, ou escolhe entre as da mensagem)
        const sel = String(window.getSelection ? window.getSelection() : '').trim(), pal = sel && sel.split(/\s+/).length <= 3 ? sel : '';
        it.push({ texto: T('Traduzir', 'Translate'), icone: 'traduzir', onclick: () => { const x = els.get(m.id); if (x) A.idiomas.traduzirMsg(m, x.el); } });
        if (A.idiomas.palavrasDe(m.texto).length) it.push({ texto: pal ? T('Dicionário: ', 'Dictionary: ') + (pal.length > 18 ? pal.slice(0, 18) + '…' : pal) : T('Dicionário', 'Dictionary'), icone: 'livro', onclick: () => A.idiomas.dicionario(pal, m.texto) });
      }
      if (m.texto) it.push({ texto: T('Copiar texto', 'Copy text'), icone: 'copiar', onclick: () => U.copiar(m.texto.replace(/<@([A-Z0-9]{6})>/gi, (_, c) => '@' + (o.nomeDe ? o.nomeDe(c.toUpperCase()) : c))) });
      if (o.fixar && !m.pendente) it.push({ texto: o.fixada && o.fixada(m) ? T('Desafixar mensagem', 'Unpin message') : T('Fixar mensagem', 'Pin message'), icone: 'alfinete', onclick: () => o.fixar(m) });
      if (o.marcarNaoLida && !m.pendente) it.push({ texto: T('Marcar como não lida', 'Mark as unread'), icone: 'marcar', onclick: () => o.marcarNaoLida(m) });
      if (meu && m.texto != null && o.editar && !m.pendente) it.push({ texto: T('Editar mensagem', 'Edit message'), icone: 'editar', onclick: () => editar(m) });
      if ((meu || (o.podeApagar && o.podeApagar(m))) && o.apagar && !m.pendente) it.push(null, { texto: T('Apagar mensagem', 'Delete message'), icone: 'lixo', perigo: true, onclick: () => apagar(m) });
      return it;
    }
    function menuMsg(e, m) { e.preventDefault(); U.menuContexto(e, itensMsg(m)); }
    // status das MINHAS mensagens (como no WhatsApp): pendente (sem internet), enviada, recebida e lida (só se os dois deixam)
    const TIQUES = { pendente: ['relogio', T('Pendente: esperando a internet', 'Pending: waiting for the internet')], enviada: ['check', T('Enviada', 'Sent')], recebida: ['check2', T('Recebida', 'Delivered')], lida: ['check2', T('Lida', 'Read')] };
    function pintarStatus(st, m) {
      const v = m.pendente ? 'pendente' : (o.statusDe(m) || 'enviada');
      if (st.dataset.v === v) return;
      st.dataset.v = v; st.className = 'cx-status ' + v; st.title = TIQUES[v][1]; st.replaceChildren(A.icone(TIQUES[v][0], 14));
    }
    function atualizarStatus() { for (const x of els.values()) { if (!x.el || !o.ehMeu(x.m)) continue; const st = x.el.querySelector('.cx-status'); if (st) pintarStatus(st, x.m); } }
    // (0.6.0) o chat fica sempre no fim: imagem, vídeo ou figurinha que termina de carregar empurra a conversa, e ela volta para baixo
    let noFundo = true;
    // rolagem parou (160 ms sem rolar): só aí arruma o que pesa (tirar as de cima, recompor o vão)
    let tRolando = 0;
    lista.addEventListener('scroll', () => { const resta = lista.scrollHeight - lista.scrollTop - lista.clientHeight;
      if (baixo.length && resta < 1400 && !voltando) { voltando = requestAnimationFrame(() => { voltando = 0; mostrarBaixo(30); }); }
      else if (!baixo.length && solto && resta < 1400) puxarRecentes();
      noFundo = !baixo.length && !solto && resta < 40; verPresente(resta); if (o.aoRolar) o.aoRolar(noFundo);
      // (0.9.4) sem a classe "rolando" na lista: ligar/desligar ela refazia o estilo de TODAS as mensagens no começo e no fim de cada
      // rolagem (e cada página antiga que entrava contava como rolagem). O próprio navegador já não refaz o "passar o mouse" enquanto rola
      if (tRolando) clearTimeout(tRolando);
      tRolando = setTimeout(() => { tRolando = 0; enxugar(); if (maisAcima && vaoH < alvoVao() / 2) cuidarVao(); }, 160); }, { passive: true });
    function grudar() { if (noFundo) lista.scrollTop = lista.scrollHeight; }
    if (window.ResizeObserver) new ResizeObserver(() => grudar()).observe(lista);
    function irPara(id, { piscar = true, bloco = 'center' } = {}) { descarregar(); if (!els.has(id) && baixo.length) { const i = baixo.findIndex((m) => m.id === id); if (i >= 0) mostrarBaixo(i + 30); } const x = els.get(id); if (!x) return false; noFundo = false; x.el.scrollIntoView({ block: bloco }); if (piscar) { x.el.classList.add('piscar'); setTimeout(() => x.el.classList.remove('piscar'), 1400); } return true; }
    // (0.9.0) qualquer arquivo (zip, exe, pdf, apk...): o cartão com o nome, o tipo e o tamanho; só baixa quando a pessoa clica
    const tamTxt = (b) => (!b ? '' : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : b < 1024 * 1024 * 1024 ? (b / 1048576).toFixed(b < 10 * 1048576 ? 1 : 0) + ' MB' : (b / 1073741824).toFixed(1) + ' GB');
    function cartaoArquivo(m, url) {
      const nome = m.anexo.nome || T('arquivo', 'file'), ext = (/\.([a-z0-9]{1,6})$/i.exec(nome) || [])[1] || '';
      const bt = U.btn('', { icone: 'download', tipo: 'sec', redondo: true, peq: true, titulo: T('Baixar', 'Download') });
      bt.addEventListener('click', async (e) => {
        e.stopPropagation(); if (bt.disabled) return; bt.disabled = true; bt.classList.add('carregando');
        try { if (o.baixarAnexo) await o.baixarAnexo(m); else if (url) await U.baixar(url, nome); } catch (er) { U.toast(er.message || T('Não consegui baixar.', 'Could not download.'), { tipo: 'erro' }); }
        bt.disabled = false; bt.classList.remove('carregando');
      });
      return h('div', { class: 'cx-arquivo' }, h('span', { class: 'cx-arq-ic', 'aria-hidden': 'true' }, A.icone('clipe', 18), ext ? h('b', {}, ext.toUpperCase()) : null),
        h('div', { class: 'cx-arq-tx' }, h('span', { title: nome }, nome), h('small', { class: 'suave' }, [ext ? ext.toUpperCase() : T('Arquivo', 'File'), tamTxt(m.anexo.tam)].filter(Boolean).join(' · '))), bt);
    }
    // (0.9.4) o tamanho de cada foto/vídeo da conversa: vem dentro da mensagem cifrada (quem mandou mediu) ou fica lembrado aqui depois que
    // ela abre uma vez. Com ele a foto já nasce ocupando o espaço certo: antes a mensagem nascia sem a foto e crescia quando ela chegava
    // (subindo pelas antigas, cada foto que chegava empurrava a conversa e montava a mensagem inteira de novo: eram os trancos)
    const dimsDe = (m) => { const a = m.anexo; if (!a) return null; const w = Number(a.w), hh = Number(a.h); if (w >= 1 && hh >= 1 && w <= 65535 && hh <= 65535) return [w, hh]; return (a.sid && DIMS.get(a.sid)) || null; };
    const caixaMidia = (tag, gif, img, nw, nh) => { const lim = gif ? 300 : img ? 320 : MIDIA_W, alt = gif ? 260 : MIDIA_H[tag]; const w = Math.round(Math.min(lim, nw, (nw * alt) / nh)); return [w, Math.max(1, Math.round((w * nh) / nw))]; };
    function esperaMidia(m) {
      const d = dimsDe(m), video = m.anexo.tipo === 'video';
      const [w, hh] = d ? caixaMidia(video ? 'VIDEO' : 'IMG', false, !video, d[0], d[1]) : [240, 180];
      return h('div', { class: 'cx-midia cx-espera', dados: { sid: m.anexo.sid }, estilo: { width: w + 'px', 'aspect-ratio': w + ' / ' + hh } });
    }
    // (0.5.9-5) cada mídia numa bolha de vidro quadrada e arredondada, que ondula devagar; áudio e vídeo com o player do Aero
    function midiaDe(m, url) {
      const tipo = (m.anexo && m.anexo.tipo) || 'imagem';
      if (tipo === 'audio') return U.pelicula(h('div', { class: 'cx-midia cx-midia-audio' }, tocadorAudio(url, m)));
      if (tipo === 'video') return midiaVideo(url, m);
      if (tipo === 'texto' && A.codigo) return A.codigo.cartao(url, { nome: m.anexo.nome || 'arquivo.txt', mime: m.anexo.mime, tam: m.anexo.tam, aoMudar: grudar }); // (0.8.3) texto e código, com cores
      const gif = !!(m.anexo && m.anexo.mime === 'image/gif'), d = dimsDe(m);
      const img = h('img', { src: url, alt: T('imagem', 'image'), loading: 'lazy', decoding: 'async', dados: { ...(gif ? { anim: '1' } : {}), ...(m.anexo && m.anexo.sid ? { sid: m.anexo.sid } : {}) } }); img.addEventListener('load', grudar, { once: true });
      if (d) { const [w, hh] = caixaMidia('IMG', false, true, d[0], d[1]); img.width = d[0]; img.height = d[1]; img.style.width = w + 'px'; img.style.height = 'auto'; img.style.aspectRatio = d[0] + ' / ' + d[1]; void hh; }
      const b = h('button', { type: 'button', class: 'cx-img', tabindex: '-1', title: T('Ver imagem', 'View image'), onclick: () => abrirImagem(url, { m, gif }) }, img);
      b.addEventListener('contextmenu', (e) => menuMidia(e, { url, tipo: gif ? 'gif' : 'imagem', m }));
      return U.pelicula(h('div', { class: 'cx-midia' }, b)); // GIF toca sozinho, em loop
    }
    // (0.9.5) várias fotos/vídeos enviados juntos: uma grade (a primeira anexada fica em cima, à esquerda). Clicar abre a galeria com setas
    function gradeMidia(m) {
      // (1.0.2) até 20: com mais de 9, aparecem 8 e a 9ª mostra "+N" (abre a galeria ali, com setas por todas)
      const todas = m.anexos.slice(0, 20), l = todas.length > 9 ? todas.slice(0, 9) : todas, n = l.length, resto = todas.length - 8;
      const g = h('div', { class: 'cx-grade n' + n + (n > 4 ? ' muitos' : '') });
      l.forEach((a, i) => { const c = celulaGrade(m, a, i); if (todas.length > 9 && i === 8) { c.classList.add('cx-gmais'); c.append(h('span', { class: 'cx-gmais-n' }, '+' + resto)); } g.append(c); });
      return U.pelicula(h('div', { class: 'cx-midia cx-midia-grade' }, g));
    }
    function celulaGrade(m, a, i) {
      const url = o.urlDe ? o.urlDe(a) : null, video = a.tipo === 'video';
      const cel = h('button', { type: 'button', class: 'cx-gcel' + (url ? '' : ' cx-espera') + (video ? ' video' : ''), tabindex: '-1', dados: { sid: a.sid || '' }, title: a.nome || '',
        onclick: (e) => { e.stopPropagation(); abrirGaleria(m, i); } });
      if (url) {
        cel.append(video ? h('video', { src: url, muted: '', preload: 'metadata', playsinline: '' }) : h('img', { src: url, alt: a.nome || '', loading: 'lazy', decoding: 'async', dados: a.mime === 'image/gif' ? { anim: '1' } : {} }));
        if (video) cel.append(h('span', { class: 'cx-gplay' }, A.icone('play', 22)));
        cel.addEventListener('contextmenu', (e) => menuMidia(e, { url, tipo: video ? 'video' : a.mime === 'image/gif' ? 'gif' : 'imagem', m: { ...m, anexo: a } }));
      }
      return cel;
    }
    function abrirGaleria(m, i) {
      const itens = m.anexos.map((a) => ({ url: o.urlDe ? o.urlDe(a) : null, video: a.tipo === 'video', nome: a.nome || nomeArquivo({ anexo: a }, a.tipo === 'video' ? 'video' : 'imagem'), link: o.linkAnexo ? o.linkAnexo({ ...m, anexo: a }) : null }));
      if (!itens[i] || !itens[i].url) return;
      U.verImagem(itens[i].url, { nome: itens[i].nome, link: itens[i].link, galeria: { itens, i } });
    }
    function corpo(m) {
      const partes = [];
      // (0.7.2) a marca "Encaminhada"; (0.7.8) acima do texto, sem cobrir nada; numa imagem, GIF ou vídeo, uma legenda embaixo (veja o fim)
      if (m.enc) partes.push(h('div', { class: 'cx-encaminhada' }, h('span', {}, A.icone('encaminhar', 12), T('Encaminhada', 'Forwarded'))));
      if (m.resp) partes.push(h('button', { type: 'button', class: 'cx-citacao', tabindex: '-1', onclick: () => { const alvo = els.get(m.resp.id); if (alvo) { alvo.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); alvo.el.classList.add('piscar'); setTimeout(() => alvo.el.classList.remove('piscar'), 1200); } else if (o.irParaMsg) o.irParaMsg(m.resp.id); } },
        A.icone('responder', 13), h('b', {}, m.resp.nome || '?'), ' ', ...resumoTrecho(m.resp.trecho, m.resp.img)));
      if (m.subindo) { // (0.8.3) o anexo ainda subindo: a prévia local, com "Enviando..."
        const sb = m.subindo, ehImg = /^image\//.test(sb.mime), ehVid = /^video\//.test(sb.mime);
        partes.push(h('div', { class: 'cx-subindo' }, ehImg ? h('img', { src: sb.url, alt: '' }) : ehVid ? h('video', { src: sb.url, muted: '' }) : h('span', { class: 'cx-anexo-ic' }, A.icone('clipe', 22)),
          h('div', { class: 'cx-subindo-info' }, h('span', { class: 'peq' }, sb.nome), h('span', { class: 'peq suave' }, T('Enviando...', 'Uploading...')), h('i', { class: 'cx-subindo-barra' }))));
      }
      // (0.9.5) o texto vem em cima e o anexo embaixo dele (antes o anexo vinha primeiro)
      const midias = [], url = o.urlAnexo ? o.urlAnexo(m) : null;
      if (m.anexos && m.anexos.length > 1 && !m.subindo) midias.push(gradeMidia(m));
      else if (m.anexo && m.anexo.tipo === 'arquivo' && !m.subindo) midias.push(cartaoArquivo(m, url));
      else if (url) midias.push(midiaDe(m, url));
      else if (m.anexo && m.anexo.sid && !m.subindo && (m.anexo.tipo === 'imagem' || m.anexo.tipo === 'video')) midias.push(esperaMidia(m));
      if (!m.texto) partes.push(...midias);
      if (m.texto) {
        const so = m.texto.trim(), urls = m.texto.match(/\bhttps?:\/\/[^\s<>"']+/g) || [];
        const soGif = urls.length === 1 && so === urls[0] && (ehGif(so) || ehPaginaKlipy(so)), soFig = /^<fig:[A-Z0-9]{6}:[0-9a-f]{10}>$/i.test(so);
        const soDiscord = urls.length === 1 && so === urls[0] && !!tipoDiscord(so); // (0.6.9) só o link de um anexo do Discord: vira a mídia, sem o texto
        const ehAero = (u) => !!(o.ehLinkMidia && o.ehLinkMidia(u)), soAero = urls.length === 1 && so === urls[0] && ehAero(so); // (0.8.3) link de mídia do Aero
        const soEmbed = urls.length === 1 && so === urls[0] && (!!idYoutube(so) || !!idTweet(so) || ehSpotify(so) || ehReddit(so) || ehLoja(so)); // (0.9.6) só o link do YouTube/X: fica só o cartão (o link vai no botão direito)
        if (soGif) partes.push(ehPaginaKlipy(so) ? gifDePagina(so, m) : midiaGif(so));
        else if (!soDiscord && !soAero && !soEmbed) partes.push(h('div', { class: 'cx-txt' + (soFig ? ' so-figurinha' : '') }, ...comLinks(m.texto, o)));
        if (!soGif && !soDiscord && !soAero && !soEmbed && !soFig && A.idiomas) { const tr = A.idiomas.bloco(m, o.ehMeu(m)); if (tr) partes.push(tr); } // (1.0.2) a tradução embaixo do texto
        partes.push(...midias);
        for (const u of [...new Set(urls)].slice(0, 3)) {
          if (ehAero(u)) { partes.push(midiaDeLink(u, m, soAero)); continue; }
          const yt = idYoutube(u); if (yt) { partes.push(embedYoutube(yt, u, () => itensMsg(m))); continue; }
          if (idTweet(u)) { partes.push(embedTweet(u, grudar, soEmbed, () => itensMsg(m))); continue; }
          if (ehReddit(u)) { partes.push(embedReddit(u, grudar, soEmbed, () => itensMsg(m))); continue; } // (1.0.2)
          if (ehLoja(u) && A.embeds) { partes.push(A.embeds.loja(u, { dados: dadosEmbed, menu: menuLink(u, T('Loja', 'Store'), () => itensMsg(m)), grudar, soLink: soEmbed })); continue; } // (1.0.2) preço, imposto, fotos e avaliações
          if (ehSpotify(u) && A.embeds) { partes.push(A.embeds.spotify(u, { dados: dadosEmbed, menu: menuLink(u, 'Spotify', () => itensMsg(m)), grudar })); continue; } // (1.0.2) com o trecho para ouvir
          if (!soGif && ehGif(u)) { partes.push(midiaGif(u)); continue; }
          if (!soGif && ehPaginaKlipy(u)) { partes.push(gifDePagina(u, m)); continue; }
          const td = tipoDiscord(u); if (td) { partes.push(midiaDiscord(u, td, m)); continue; }
          const cv = codigoConvite(u); if (cv && o.convite) partes.push(o.convite(cv));
        }
        const cv2 = !urls.length && codigoConvite(m.texto); if (cv2 && o.convite) partes.push(o.convite(cv2));
      }
      // (0.7.2) reações embaixo da mensagem
      // (0.7.9) numa imagem, GIF ou vídeo a marca vai para baixo da película, como uma legenda
      if (m.enc && partes[1] && !partes[1].matches('.cx-txt, .cx-citacao')) { const marca = partes.shift(); marca.classList.add('na-midia'); partes.splice(1, 0, marca); }
      if (o.reagir && m.rea && Object.keys(m.rea).length) partes.push(chipsReacao(m));
      return partes;
    }
    // (0.8.3) link de mídia do Aero (copiado de outra conversa): baixa, abre aqui e vira a imagem/GIF/vídeo; sem acesso, fica o link mesmo
    function midiaDeLink(u, m, so) {
      const lugar = h('div', { class: 'cx-gif-espera' });
      o.midiaDeLink(u).then((d) => {
        if (!lugar.parentNode) return;
        if (!d) { lugar.replaceWith(so ? h('div', { class: 'cx-txt' }, ...comLinks(u, o)) : h('span')); return; }
        let el;
        if (/^video\//.test(d.mime)) el = midiaVideo(d.url, null);
        else if (d.mime === 'image/gif') el = midiaGif(d.url, u);
        else {
          const img = h('img', { src: d.url, alt: T('imagem', 'image') }); img.addEventListener('load', grudar, { once: true });
          const b = h('button', { type: 'button', class: 'cx-img', tabindex: '-1', title: T('Ver imagem', 'View image'), onclick: () => U.verImagem(d.url, { nome: d.nome || 'aero-imagem.png', link: u }) }, img);
          b.addEventListener('contextmenu', (e) => menuMidia(e, { url: d.url, tipo: 'imagem', link: u }));
          el = U.pelicula(h('div', { class: 'cx-midia' }, b));
        }
        lugar.replaceWith(el); grudar();
      });
      return lugar;
    }
    // (0.7.1) link de página do Klipy: um lugar guardado enquanto o servidor acha o GIF; sem GIF, a mensagem mostra o link mesmo
    function gifDePagina(u, m) {
      const lugar = h('div', { class: 'cx-gif-espera' });
      dadosEmbed(u).then((d) => {
        if (!lugar.isConnected && !lugar.parentNode) return;
        if (d && d.tipo === 'gif' && d.url) { lugar.replaceWith(midiaGif(d.url)); grudar(); return; }
        const so = m && m.texto && m.texto.trim() === u;
        lugar.replaceWith(so ? h('div', { class: 'cx-txt' }, ...comLinks(u, o)) : h('span'));
      });
      return lugar;
    }
    function midiaGif(url, link) {
      const src = U.imgSegura(url) || url; // (1.0.0) GIF de site qualquer vem pelo proxy do servidor (o site não vê o IP de quem abriu)
      const img = h('img', { src, alt: 'GIF', loading: 'lazy', decoding: 'async', draggable: 'false' });
      img.addEventListener('load', () => { ajustarMidia({ target: img }); grudar(); }, { once: true }); // (0.7.3) ajusta mesmo carregando fora da lista
      const b = h('button', { type: 'button', class: 'cx-img cx-gif', tabindex: '-1', title: 'GIF', onclick: () => abrirImagem(src, { gif: true, link: link || (src !== url ? url : undefined) }) }, img);
      b.addEventListener('contextmenu', (e) => menuMidia(e, { url: src, tipo: 'gif', link: link || (src !== url ? url : undefined) }));
      // (0.7.0) o GIF ganha a mesma bolha animada dos outros embeds, e a estrela de favoritar fica no canto DA IMAGEM (antes ia para longe)
      const est = o.favoritarGif ? h('button', { type: 'button', class: 'cx-gif-fav' + (o.gifFavorito && o.gifFavorito(url) ? ' on' : ''), title: T('Favoritar GIF', 'Favorite GIF'), onclick: async (e) => { e.stopPropagation(); await o.favoritarGif(url, img.naturalWidth, img.naturalHeight); est.classList.toggle('on', !!(o.gifFavorito && o.gifFavorito(url))); } }, A.icone('estrela', 15)) : null;
      return U.pelicula(h('div', { class: 'cx-midia cx-gif-caixa' }, h('div', { class: 'cx-gif-quadro' }, b, est)));
    }
    // (1.0.0) a barrinha começa pequena só com responder, editar e apagar; segurar Shift com o mouse em cima estende o resto (as reações, encaminhar, copiar)
    if (!window.__aeroShift) {
      window.__aeroShift = true;
      const raizH = document.documentElement, marca = (v) => { if (v) raizH.dataset.shift = '1'; else delete raizH.dataset.shift; };
      addEventListener('keydown', (e) => { if (e.key === 'Shift') marca(true); }, true);
      addEventListener('keyup', (e) => { if (e.key === 'Shift') marca(false); }, true);
      addEventListener('blur', () => marca(false));
      addEventListener('pointermove', (e) => { if (!!e.shiftKey !== !!raizH.dataset.shift) marca(e.shiftKey); }, { passive: true }); // apertou o Shift com a janela sem foco
    }
    function acoes(m) {
      const meu = o.ehMeu(m);
      const b = (ic, t, f, extra = 'cx-acao-extra') => h('button', { type: 'button', class: 'cx-acao ' + extra, title: t, 'aria-label': t, onclick: (e) => { e.stopPropagation(); f(e); } }, A.icone(ic, 16));
      const lista = [];
      if (o.reagir && !m.pendente && !m.trancada) {
        for (const e of recentes().slice(0, 3)) lista.push(h('button', { type: 'button', class: 'cx-acao cx-acao-emoji cx-acao-extra', title: T('Reagir com ', 'React with ') + e, onclick: (ev) => { ev.stopPropagation(); reagir(m, e); } }, e));
        lista.push(b('emoji', T('Adicionar reação', 'Add reaction'), (ev) => escolherReacao(ev.currentTarget, m)));
      }
      lista.push(b('responder', T('Responder', 'Reply'), () => responder(m), ''));
      if (o.encaminhar && !m.pendente && !m.trancada) lista.push(b('encaminhar', T('Encaminhar', 'Forward'), () => o.encaminhar(m)));
      if (m.texto) lista.push(b('copiar', T('Copiar', 'Copy'), (e) => U.copiar(m.texto, e.currentTarget)));
      if (meu && m.texto != null && o.editar) lista.push(b('editar', T('Editar', 'Edit'), () => editar(m), ''));
      if ((meu || (o.podeApagar && o.podeApagar(m))) && o.apagar) lista.push(b('lixo', T('Apagar', 'Delete'), () => apagar(m), 'perigo'));
      return h('div', { class: 'cx-acoes vidro' }, ...lista);
    }
    // (0.8.3) as mensagens longe da parte visível ficam com as animações PAUSADAS (estilos de bolha, brilhos, efeitos): antes cada mensagem
    // antiga carregada continuava animando fora da tela, e quanto mais mensagens antigas, mais lento ficava. Voltam a animar antes de aparecer
    const perto = window.IntersectionObserver ? new IntersectionObserver((es) => { for (const e of es) e.target.classList.toggle('longe', !e.isIntersecting); }, { root: lista, rootMargin: '700px 0px' }) : null;
    const vigiar = (el) => { if (perto) { el.classList.add('longe'); perto.observe(el); } return el; }; // (0.9.2) nasce parada; o observador liga a que está perto da tela
    const largar = (el) => { if (perto && el) perto.unobserve(el); };
    function pintar(m, junto) { return vigiar(pintar0(m, junto)); }
    function pintar0(m, junto) {
      // mensagem do sistema (chamada iniciada / quanto durou): uma linha no meio, como no Discord
      if (m.sistema) return h('div', { class: 'cx-sis' + (m.sistema === 'perdida' ? ' perdida' : '') + (m.sistema === 'fixou' ? ' fixou' : ''), dados: { id: m.id } }, A.icone(m.sistema === 'perdida' ? 'desligarTel' : m.sistema === 'fixou' ? 'alfinete' : 'telefone', 15), h('span', {}, m.texto),
        m.sistema === 'fixou' && m.alvo ? h('button', { type: 'button', class: 'cx-sis-ver', onclick: () => { const alvo = els.get(m.alvo); if (alvo && alvo.el && alvo.el.isConnected) { alvo.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); alvo.el.classList.add('piscar'); setTimeout(() => alvo.el.classList.remove('piscar'), 1200); } else if (o.irParaMsg) o.irParaMsg(m.alvo); } }, T('Ver mensagem', 'See message')) : null, selo(m.t));
      const meu = o.ehMeu(m);
      // (0.5.9-6) a foto (e o nome) abrem o mini perfil da pessoa, quando o chat sabe de quem é a conta
      const cod = o.perfilDe ? o.perfilDe(m) : null;
      const mini = (e) => { e.stopPropagation(); if (A.perfil && A.perfil.mini) A.perfil.mini(cod, e.currentTarget.closest('.cx-msg').querySelector('.cx-av-btn') || e.currentTarget); };
      const av = junto ? h('span', { class: 'cx-av-vazio' }, h('time', { class: 'cx-hora-lado', title: exata(m.t), 'aria-hidden': 'true' }, hora(m.t))) : cod ? h('button', { type: 'button', class: 'cx-av-btn', tabindex: '-1', title: T('Ver perfil', 'View profile'), onclick: mini, onpointerenter: () => A.perfil && A.perfil.adiantar && A.perfil.adiantar(cod) }, U.avatar(o.avatar(m), 34)) : U.avatar(o.avatar(m), 34);
      if (m.bloqueada) return h('div', { class: 'cx-msg cx-oculta' + (junto ? ' junto' : ''), dados: { id: m.id } }, junto ? h('span', { class: 'cx-av-vazio' }) : h('span', { class: 'cx-av-vazio' }), h('div', { class: 'cx-conteudo peq suave' }, T('Mensagem oculta (bloqueio)', 'Hidden message (block)')));
      const paraMim = !meu && meChama(m.texto);
      const st = meu && o.statusDe ? h('span', { class: 'cx-status', dados: { seq: m.id }, title: '' }) : null;
      // (0.6.1) o texto vai numa bolha do tamanho dele (como no WhatsApp, com o vidro do Aero); "(editada)" e o status de leitura ficam
      // DENTRO da bolha, no canto. Mensagem só de mídia (GIF, imagem, figurinha): o status fica ao lado dela.
      const partes = corpo(m), bolhaTxt = [...partes].reverse().find((x) => x && x.classList && x.classList.contains('cx-txt') && !x.classList.contains('so-figurinha'));
      const rodape = [m.editado ? h('span', { class: 'cx-editado' }, T('(editada)', '(edited)')) : null, st].filter(Boolean);
      if (bolhaTxt && rodape.length) bolhaTxt.append(h('span', { class: 'cx-rodape' }, ...rodape));
      const bal = h('div', { class: 'cx-bal' + (!bolhaTxt && st ? ' status-solto' : '') }, ...partes, bolhaTxt ? null : rodape);
      const el2 = h('div', { class: 'cx-msg' + (meu ? ' eu' : '') + (junto ? ' junto' : '') + (paraMim ? ' mencionado' : '') + (m.pendente ? ' pendente' : ''), tabindex: '0', dados: { id: m.id }, 'aria-label': o.nome(m) + ': ' + (m.texto || T('imagem', 'image')) },
        av,
        h('div', { class: 'cx-conteudo' }, junto ? null : h('div', { class: 'cx-cab' }, h('b', cod ? { class: 'clicavel', onclick: mini, dados: { nomeCod: cod } } : {}, o.nome(m)), o.selosDe && A.ui.selos ? A.ui.selos(o.selosDe(m)) : null, selo(m.t)),
          bal),
        null);
      if (st) pintarStatus(st, m);
      if (o.nomeEstiloDe && !junto) { const nb = el2.querySelector('.cx-cab > b'); if (nb) A.ui.aplicarNome(nb, o.nomeEstiloDe(m)); } // (0.8.0) o estilo do nome que a pessoa escolheu
      if (o.bolhaDe) A.ui.aplicarBolha(el2, o.bolhaDe(m)); // (0.8.0) a bolha que a pessoa escolheu (modelo e cores)
      if (el2.dataset.bc === 'aquario') { const tx = el2.querySelector('.cx-txt:not(.so-figurinha)'); if (tx) A.ui.pelicula(tx); } // a película animada das embeds
      el2.addEventListener('contextmenu', (e) => { if (e.target.closest('.cx-img, video, audio, a, .cx-yt')) return; menuMsg(e, el2._m || m); });
      // (0.5.9-9) os botões (responder, copiar, editar, apagar) só nascem quando o mouse ou o foco chega na mensagem: antes cada mensagem
      // já vinha com 4 botões e ícones escondidos, e abrir um grupo com muitas mensagens montava centenas de elementos à toa
      const comAcoes = () => { el2.removeEventListener('pointerenter', comAcoes); el2.removeEventListener('focusin', comAcoes); el2.append(acoes(el2._m || m)); };
      el2.addEventListener('pointerenter', comAcoes); el2.addEventListener('focusin', comAcoes);
      return el2;
    }
    const noFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
    let ultima = null; // a última mensagem da lista (antes: [...els.values()].pop() copiava a lista inteira a cada mensagem)
    function montar(m, destino) {
      const ant = ultima;
      const junto = !!(ant && !ant.m.sistema && !m.sistema && ant.m.de === m.de && m.t - ant.m.t < 5 * 60000 && !m.resp); // mensagens seguidas da mesma pessoa: sem repetir nome/foto
      const e = pintar(m, junto); ultima = { m, el: e, junto }; els.set(m.id, ultima); destino.append(e);
      if (o.aoMontar) o.aoMontar(m); // (0.9.4) a mídia que saiu da memória (longe da tela) é aberta de novo ao voltar
      return e;
    }
    // (0.8.0) a sua mensagem aparece na hora (a cópia "pendente") e é trocada pela de verdade quando o servidor confirma: a de verdade
    // entra parada no mesmo lugar, para a bolha "nascer" uma vez só
    let trocando = null;
    function adicionar(m) {
      if (els.has(m.id)) { atualizar(m); return; }
      if (solto) { if (o.ehMeu(m)) irAoPresente(); return; } // (0.9.1) lendo um trecho antigo: as novas chegam quando descer (a sua leva ao fim)
      if (baixo.length) { // (0.9.0) lendo as antigas: a nova fica guardada com as de baixo (a sua leva você de volta ao fim)
        const i = baixo.findIndex((x) => x.id === m.id); if (i >= 0) { baixo[i] = { ...baixo[i], ...m }; return; }
        if (!o.ehMeu(m)) { baixo.push(m); return; }
        mostrarBaixo(Infinity);
      }
      const fim = noFim() || noFundo;
      // (0.8.1) a de verdade toma o lugar da cópia "pendente" no mesmo quadro (antes a cópia sumia primeiro e a mensagem piscava)
      let velha = null;
      if (!m.pendente && o.ehMeu(m)) {
        const i = saindo.findIndex((x) => (x.m.texto || '') === (m.texto || ''));
        if (i >= 0) { velha = saindo[i]; saindo.splice(i, 1); clearTimeout(velha.timer); }
        else for (const x of els.values()) if (x.m.pendente && (x.m.texto || '') === (m.texto || '') && x.el.isConnected) { velha = x; els.delete(x.m.id); break; }
      }
      const troca = !!velha || (trocando && !m.pendente && o.ehMeu(m) && (m.texto || '') === trocando.texto && Date.now() - trocando.t < 15000);
      if (troca) trocando = null;
      let el2;
      const mesmo = velha && !velha.m.anexo && !m.anexo && (velha.m.texto || '') === (m.texto || '') && JSON.stringify(velha.m.resp || null) === JSON.stringify(m.resp || null);
      if (velha && velha.el.isConnected && mesmo) {
        // (0.8.3) a de verdade é a mesma bolha: ela fica onde está (a animação de envio continua) e só ganha o número e o visto. Nada
        // é montado de novo, então a foto, o nome e a bolha não recarregam nem piscam
        el2 = velha.el; el2._m = m; el2.dataset.id = m.id; el2.classList.remove('pendente');
        const ac = el2.querySelector(':scope > .cx-acoes'); if (ac) ac.replaceWith(acoes(m));
        const st = el2.querySelector('.cx-status'); if (st) { st.dataset.seq = m.id; pintarStatus(st, m); }
        const ent = { m, el: el2, junto: velha.junto }; els.set(m.id, ent);
        if (!ultima || ultima.el === velha.el) ultima = ent;
      } else if (velha && velha.el.isConnected) {
        el2 = pintar(m, velha.junto); el2.classList.add('ja');
        const ent = { m, el: el2, junto: velha.junto }; els.set(m.id, ent);
        if (!ultima || ultima.el === velha.el) ultima = ent;
        largar(velha.el); velha.el.replaceWith(el2);
      } else { el2 = montar(m, lista); if (troca) el2.classList.add('ja'); }
      if (fim || o.ehMeu(m)) { noFundo = true; lista.scrollTop = lista.scrollHeight; }
    }
    // (1.0.0) a super reação: o emoji sai grande da mensagem, com uma chuva de cópias pequenas (com "menos animações", só o chip)
    function superReacao(id, sup) {
      const x = els.get(id); if (!x || !x.el || !x.el.isConnected || document.documentElement.dataset.anim === 'nenhuma') return;
      const r = x.el.getBoundingClientRect(), cx0 = r.left + Math.min(r.width, 260) / 2, cy0 = r.top + r.height / 2;
      const camada = h('div', { class: 'px-super', 'aria-hidden': 'true' }, h('span', { class: 'px-super-grande', estilo: { left: cx0 + 'px', top: cy0 + 'px' } }, sup.e),
        ...Array.from({ length: 14 }, (_, i) => h('span', { class: 'px-super-p', estilo: { left: cx0 + 'px', top: cy0 + 'px', '--ang': (i * 360 / 14 + Math.random() * 20) + 'deg', '--dist': (70 + Math.random() * 90) + 'px', '--d': (Math.random() * 0.15).toFixed(2) + 's' } }, sup.e)));
      document.body.append(camada); A.som.tocar('compartilhar');
      setTimeout(() => camada.remove(), 1700);
    }
    function atualizar(m) {
      const x = els.get(m.id); if (!x) { const i = baixo.findIndex((y) => y.id === m.id); if (i >= 0) baixo[i] = { ...baixo[i], ...m }; return; }
      x.m = { ...x.m, ...m };
      const novo = pintar(x.m, x.junto); novo.classList.add('ja'); // (0.5.9-9) editada ou com a foto carregada: troca sem "nascer" de novo
      largar(x.el); x.el.replaceWith(novo); x.el = novo; grudar();
    }
    // (0.9.4) a foto/vídeo da mensagem abriu: troca só o espaço reservado pela mídia (antes a mensagem inteira era montada de novo:
    // nome, foto, bolha, película... e a conversa pulava com a altura nova)
    function midiaPronta(m, a) {
      const x = els.get(m.id); if (!x) { atualizar(m); return; }
      x.m = { ...x.m, ...m }; if (x.el._m) x.el._m = x.m;
      if (x.m.anexos && x.m.anexos.length > 1) { // (0.9.5) uma foto da grade ficou pronta: só a casinha dela
        const l = a ? [a] : x.m.anexos;
        for (const b of l) { const i = x.m.anexos.indexOf(b), cel = b.sid && x.el.querySelector('.cx-gcel[data-sid="' + b.sid + '"]'); if (cel && i >= 0 && cel.classList.contains('cx-espera') && o.urlDe && o.urlDe(b)) cel.replaceWith(celulaGrade(x.m, b, i)); }
        return;
      }
      const esp = x.el.querySelector('.cx-espera'), url = o.urlAnexo ? o.urlAnexo(x.m) : null;
      if (!esp || !url) { atualizar(m); return; }
      esp.replaceWith(midiaDe(x.m, url));
    }
    // (0.8.3) a pessoa trocou a bolha: as mensagens dela na tela trocam com um esmaecer rápido (a antiga some enquanto a nova aparece);
    // as que estão longe da tela trocam direto, sem animação
    function trocarBolhas(deQuem) {
      for (const x of els.values()) {
        if (!x.el || !x.el.isConnected || x.m.sistema || x.m.bloqueada || !deQuem(x.m)) continue;
        const velho = x.el, longe = velho.classList.contains('longe');
        const novo = pintar(x.m, x.junto); novo.classList.add('ja');
        if (!longe) novo.classList.add('bc-troca');
        largar(velho); velho.replaceWith(novo); x.el = novo;
        if (!longe) setTimeout(() => novo.classList.remove('bc-troca'), 600);
      }
      grudar();
    }
    const saindo = []; // as cópias "pendentes" já confirmadas: ficam na tela até a de verdade chegar (no máximo 4 s)
    function remover(id, quieto) {
      const x = els.get(id); if (!x) { const i = baixo.findIndex((y) => y.id === id); if (i >= 0) baixo.splice(i, 1); return; }
      if (x.m && x.m.pendente && quieto) { els.delete(id); const s = { ...x, timer: setTimeout(() => { const i = saindo.indexOf(s); if (i >= 0) { saindo.splice(i, 1); s.el.remove(); if (ultima && ultima.el === s.el) ultima = [...els.values()].pop() || null; } }, 4000) }; saindo.push(s); return; }
      largar(x.el); if (quieto) x.el.remove(); else { A.som.tocar('estourar'); x.el.classList.add('estourando'); setTimeout(() => x.el.remove(), 420); } els.delete(id); if (ultima === x) ultima = [...els.values()].pop() || null; } // apagada: a bolha estoura
    // (0.5.9-9) a lista inteira de uma vez: monta tudo fora da tela e põe num passo só, sem medir a rolagem a cada mensagem (cada medida
    // obrigava o navegador a refazer o layout da conversa inteira) e sem animar dezenas de mensagens ao mesmo tempo (só as que chegam depois)
    function definir(msgs, op) {
      largarFila(); vaoH = 0; maisAcima = false; vao.style.height = '0px'; if (perto) perto.disconnect(); lista.textContent = ''; els.clear(); ultima = null; saindo.length = 0; baixo.length = 0;
      solto = !!(op && op.solto); indoPresente = false; btnPresente.hidden = !solto;
      const frag = document.createDocumentFragment();
      for (const m of msgs || []) { if (els.has(m.id)) continue; montar(m, frag).classList.add('ja'); }
      lista.append(frag); lista.scrollTop = lista.scrollHeight; noFundo = !solto;
    }

    // (0.5.9-9) várias de uma vez (ao abrir a conversa): um passo só, sem medir a rolagem a cada uma e sem animar o lote inteiro
    function adicionarVarias(msgs) {
      if (baixo.length) { for (const m of msgs || []) { if (els.has(m.id)) atualizar(m); else adicionar(m); } return; }
      const fim = noFim(), frag = document.createDocumentFragment();
      for (const m of msgs || []) { if (els.has(m.id)) atualizar(m); else montar(m, frag).classList.add('ja'); }
      lista.append(frag);
      if (fim || noFundo) { noFundo = true; lista.scrollTop = lista.scrollHeight; }
    }
    // mensagens mais antigas (paginação): entram no topo, mantendo o agrupamento certo
    // (0.7.3) antes refazia a lista inteira (definir), que mandava o chat para o fim: quem subia para ler as antigas era jogado de volta para
    // baixo. Agora só as antigas entram, antes da primeira; a rolagem fica no mesmo lugar e o chat continua "parado" se você não estava no fim
    function antes(msgs) {
      const novas = (msgs || []).filter((m) => !els.has(m.id)); if (!novas.length) return;
      const eraFundo = noFundo, guardada = ultima, velhas = [...els.entries()];
      const prim = velhas.length ? velhas[0][1] : null;
      ultima = null; els.clear();
      const frag = document.createDocumentFragment();
      for (const m of novas) { if (els.has(m.id)) continue; montar(m, frag).classList.add('ja'); }
      const ultNova = ultima;
      for (const [id, x] of velhas) els.set(id, x);
      // a primeira das que já estavam pode virar "junto" (mesma pessoa logo depois): repinta só ela
      if (prim && ultNova) {
        const junto = !ultNova.m.sistema && !prim.m.sistema && ultNova.m.de === prim.m.de && prim.m.t - ultNova.m.t < 5 * 60000 && !prim.m.resp;
        if (junto !== prim.junto) { prim.junto = junto; const novo = pintar(prim.m, junto); novo.classList.add('ja'); largar(prim.el); prim.el.replaceWith(novo); prim.el = novo; }
      }
      ultima = guardada || ultNova;
      noFundo = eraFundo;
      // (0.9.4) a página entra de uma vez só, ocupando o vão de cima (ver abaixo): nada do que está na tela se mexe
      const nos = [...frag.childNodes];
      for (let i = nos.length - 1; i >= 0; i--) filaTopo.push(nos[i]); // da mais perto da tela para a mais antiga
      inserirTopo();
    }
    // (0.9.4) o "vão" de cima: um espaço vazio guardado acima das mensagens enquanto há mais histórico. As antigas entram OCUPANDO o vão (ele
    // encolhe na mesma medida), então nada do que está na tela sai do lugar: antes cada página que entrava empurrava a conversa inteira para
    // baixo e a rolagem puxava de volta, e o navegador redesenhava tudo (era o tranco ao subir). Tirar as de cima faz o contrário: o vão cresce
    const vao = h('div', { class: 'cx-vao', 'aria-hidden': 'true' }); let vaoH = 0, maisAcima = false;
    const primeiraNaTela = () => { for (const x of els.values()) if (x.el.parentNode === lista) return x.el; return null; };
    function porVao(px) {
      vaoH = Math.max(0, px); vao.style.height = vaoH + "px"; // sem arredondar: meio pixel a mais já mexia a conversa inteira
      const ref = primeiraNaTela();
      if (ref && vao.nextSibling !== ref) lista.insertBefore(vao, ref); else if (!ref && !vao.isConnected) lista.append(vao);
    }
    // muda o vão mexendo na rolagem junto (só quando precisa: ao abrir, ao chegar no começo da conversa, ou com a rolagem parada)
    function ajustarVao(px) { if (Math.abs(px - vaoH) < 0.5) return; const deBaixo = lista.scrollHeight - lista.scrollTop; porVao(px); lista.scrollTop = lista.scrollHeight - deBaixo; }
    const alvoVao = () => Math.max(1500, lista.clientHeight * 2.5);
    function cuidarVao() { if (filaTopo.length) return; if (!maisAcima) ajustarVao(0); else if (vaoH < alvoVao() / 2) ajustarVao(alvoVao()); }
    function semMaisAcima(fim) { maisAcima = !fim; if (!filaTopo.length && (fim || vaoH < alvoVao() / 2)) cuidarVao(); }
    // (0.9.4) testado: em pedaços por quadro ficava pior (cada pedaço pagava o redesenho da lista inteira); de uma vez só, ocupando o vão, é um
    // quadro só e sem mexer na rolagem
    const filaTopo = [];
    function inserirTopo() {
      if (!filaTopo.length) return;
      const pedaco = filaTopo.splice(0).reverse(), f = document.createDocumentFragment(); f.append(...pedaco);
      const ref = primeiraNaTela();
      if (!ref) lista.append(f);
      else {
        // (1.0.2) mede onde a mensagem da tela estava e devolve ela ao mesmo lugar no fim. Antes somava a diferença por conta própria, e o
        // navegador (que também segura a rolagem sozinho) já tinha somado: a conversa pulava para trás ao subir lendo as antigas
        const antes = ref.getBoundingClientRect().top;
        if (vaoH > 0) {
          if (vao.nextSibling !== ref) lista.insertBefore(vao, ref);
          lista.insertBefore(f, ref);
          const alt = ref.getBoundingClientRect().top - pedaco[0].getBoundingClientRect().top;
          porVao(alt <= vaoH ? vaoH - alt : 0);
        } else lista.insertBefore(f, ref);
        const d = ref.getBoundingClientRect().top - antes;
        if (Math.abs(d) >= 0.5) lista.scrollTop += d;
      }
      depois(podarBaixo); if (!maisAcima) depois(cuidarVao);
    }
    const descarregar = () => inserirTopo();
    const largarFila = () => { filaTopo.length = 0; };
    const primeiraId = () => { const k = els.keys().next(); return k.done ? null : k.value; };
    // (0.9.0) como o Discord: a conversa mantém só umas ~200 mensagens montadas. Subindo para ler as antigas, as lá de baixo (bem longe da
    // tela) saem da página e ficam guardadas na memória; descendo, voltam em lotes e as lá de cima saem (o app busca de novo se subir).
    // Antes cada página antiga só somava mensagens, e com centenas delas montadas o app inteiro travava
    const MAXM = A.plat && A.plat.celular ? 80 : 120, LEVE = A.plat && A.plat.celular ? 50 : 70;
    // (0.9.2) de volta ao fim depois de ler as antigas: a conversa fica tão leve quanto recém-aberta (só as últimas ~70 montadas). Antes as
    // ~220 do caminho continuavam na página, e o chat só ficava leve de novo fechando e abrindo a conversa
    function enxugar() {
      if (!noFundo || baixo.length || solto || els.size <= LEVE + 20) return;
      podarTopo(LEVE, -lista.clientHeight);
    }
    const baixo = []; let voltando = 0;
    // (0.9.1) "solto": a lista mostra um trecho antigo da conversa (pulou para uma mensagem); as mais novas vêm do servidor ao descer
    let solto = false, puxando = false, indoPresente = false;
    function verPresente(resta) {
      const r = resta == null ? lista.scrollHeight - lista.scrollTop - lista.clientHeight : resta;
      const ver = solto || (baixo.length > 0 && r > lista.clientHeight);
      if (btnPresente.hidden === ver) btnPresente.hidden = !ver;
    }
    function irAoPresente() {
      if ((solto || baixo.length > 40) && o.aoPresente) { if (indoPresente) return; indoPresente = true; Promise.resolve(o.aoPresente()).catch(() => {}).finally(() => { indoPresente = false; }); return; }
      mostrarBaixo(Infinity); noFundo = true; lista.scrollTop = lista.scrollHeight; verPresente();
    }
    async function puxarRecentes() {
      if (puxando || !o.maisRecentes || !ultima || typeof ultima.m.id !== 'number') return;
      puxando = true;
      try {
        const r = await o.maisRecentes(ultima.m.id);
        if (r && solto) {
          const frag = document.createDocumentFragment();
          for (const m of r.msgs || []) { if (els.has(m.id)) continue; montar(m, frag).classList.add('ja'); }
          lista.append(frag); solto = !r.fim; depois(podarTopo); verPresente();
        }
      } catch (e) { /* tenta de novo ao rolar */ }
      puxando = false;
    }
    const posDe = (el) => { const r = el.getBoundingClientRect(), rl = lista.getBoundingClientRect(); return { top: r.top - rl.top, bottom: r.bottom - rl.top }; };
    // (0.9.4) tirar as que ficaram longe espera o quadro ser desenhado: medir logo depois de pôr mensagens novas obrigava o navegador a
    // calcular tudo de novo na hora (era metade do tranco de cada página antiga)
    const podas = new Set(); let podaAg = 0;
    const depois = (fn) => { podas.add(fn); if (podaAg) return; podaAg = requestAnimationFrame(() => setTimeout(() => { podaAg = 0; const l = [...podas]; podas.clear(); for (const f of l) f(); }, 0)); };
    function podarBaixo() {
      if (els.size <= MAXM) return;
      const ents = [...els.values()], lim = Math.max(lista.clientHeight * 3, lista.clientHeight + 2400);
      let n = 0;
      for (let i = ents.length - 1; i >= 0 && ents.length - n > MAXM; i--) {
        const x = ents[i]; if (x.m.pendente || x.m.subindo || !x.el.isConnected || posDe(x.el).top < lim) break;
        n++;
      }
      if (!n) return;
      const sai = ents.slice(ents.length - n);
      for (const x of sai) { largar(x.el); x.el.remove(); els.delete(x.m.id); }
      baixo.unshift(...sai.map((x) => x.el._m || x.m));
      ultima = ents[ents.length - n - 1] || null; noFundo = false;
    }
    function mostrarBaixo(qtd) {
      if (!baixo.length) return;
      const frag = document.createDocumentFragment();
      for (const m of baixo.splice(0, qtd)) { if (els.has(m.id)) continue; montar(m, frag).classList.add('ja'); }
      lista.append(frag);
      depois(podarTopo);
    }
    function podarTopo(max = MAXM, lim0) {
      if (els.size <= (lim0 == null ? max + 40 : max)) return;
      const ents = [...els.values()], lim = lim0 == null ? -Math.max(lista.clientHeight * 3, 2400) : lim0;
      let n = 0;
      for (let i = 0; i < ents.length && ents.length - n > max; i++) {
        const x = ents[i]; if (!x.el.isConnected || posDe(x.el).bottom > lim) break;
        n++;
      }
      if (!n) return;
      const alt = posDe(ents[n] ? ents[n].el : vao).top - posDe(ents[0].el).top; // o vão cresce no lugar delas: nada abaixo se mexe
      const fixa = ents[n + 1] ? ents[n + 1].el : null, antes = fixa ? fixa.getBoundingClientRect().top : 0;
      for (const x of ents.slice(0, n)) { largar(x.el); x.el.remove(); els.delete(x.m.id); }
      // a primeira que ficou mostra o nome e a foto de novo
      const prim = ents[n];
      if (prim && prim.junto) { prim.junto = false; const novo = pintar(prim.el._m || prim.m, false); novo.classList.add('ja'); largar(prim.el); prim.el.replaceWith(novo); prim.el = novo; if (ultima === prim) ultima = prim; }
      maisAcima = true; porVao(vaoH + alt);
      if (fixa && fixa.isConnected) { const d = fixa.getBoundingClientRect().top - antes; if (Math.abs(d) >= 0.5) lista.scrollTop += d; } // (1.0.2) a da tela não sai do lugar
      if (o.aoPodarTopo) o.aoPodarTopo();
    }

    // (0.6.9) "Mencionar" no botão direito de uma pessoa: escreve "@Nome " no campo (vira a menção dela ao enviar)
    const mencionar = (p) => {
      if (!p || !p.codigo || !p.nome) return;
      const pos = inp.selectionStart ?? inp.value.length, antes = inp.value.slice(0, pos), txt = (antes && !/\s$/.test(antes) ? ' ' : '') + '@' + p.nome + ' ';
      inp.value = antes + txt + inp.value.slice(pos); const np = pos + txt.length; try { inp.setSelectionRange(np, np); } catch (e) { /* ok */ }
      marcados.set('@' + p.nome, p.codigo); autoAltura(); inp.focus({ preventScroll: true }); A.som.tocar('bolha');
    };
    // (0.8.3) volta o rascunho desta conversa (texto e anexos que ficaram no campo)
    if (o.rascunho && RASCUNHOS.has(o.rascunho)) { const r = RASCUNHOS.get(o.rascunho); inp.value = r.texto || ''; anexos = (r.anexos || []).slice(); pintarAnexos(); autoAltura(); }
    return { el, lista, inp, adicionar, adicionarVarias, atualizar, midiaPronta, primeiraId, semMaisAcima, vaoTopo: () => vaoH, remover, definir, antes, mencionar, focar: () => inp.focus({ preventScroll: true }), responder, escolherArquivo, digitando, parouDeDigitar,
      atualizarStatus, trocarBolhas, irPara, grudar, noFundo: () => noFundo,
      // (0.8.7) a mídia e os links de uma mensagem, do mesmo jeito do chat (busca e fixadas): abrir, copiar imagem/link, tocar áudio e vídeo
      previa: (m) => h('div', { class: 'cx-previa-midia' }, ...corpo({ ...m, rea: null, resp: null, enc: null })), tem: (id) => els.has(id) || baixo.some((m) => m.id === id), perto: (id) => els.has(id) || (() => { const i = baixo.findIndex((m) => m.id === id); return i >= 0 && i < 150; })(), mensagens: () => [...els.values()].map((x) => x.m).concat(baixo), inserir, enviarTexto: (t) => o.enviar({ texto: t }), superReacao };
  }

  // (0.8.7) a grade de emojis do chat, reaproveitada em outros lugares (ex.: o indicador de digitação): categorias, tom de pele e busca pelo
  // nome (em português ou inglês; os nomes só carregam na primeira busca)
  // (1.0.2) conversões automáticas (desligadas por padrão, em Chats): <3 vira ❤️, :) vira 🙂... só a "palavra" inteira, nunca dentro de links
  const CONVERSOES = [['<3', '❤️'], ['</3', '💔'], ['<33', '💕'], [':)', '🙂'], [':-)', '🙂'], [':D', '😃'], ['xD', '😆'], ['XD', '😆'], [';)', '🥲'], [';-)', '🥲'],
    [':(', '🙁'], [':-(', '🙁'], [":'(", '😢'], ["T_T", '😭'], [":')", '🥹'], [':P', '😛'], [':p', '😛'], [';P', '😜'], [':O', '😮'], [':o', '😮'], [':|', '😐'], [':/', '😕'], [':s', '😖'],
    ['>:(', '😠'], ['>:)', '😈'], ['B)', '😎'], ['8)', '😎'], [':*', '😘'], ['^^', '😊'], ['^_^', '😊'], ['-_-', '😑'], ['¬¬', '😒'], ['O:)', '😇'], [':3', '😺'], ['o/', '👋'], ['\\o/', '🙌'], ['(y)', '👍'], ['(n)', '👎'], ['<(")', '🐧']];
  const MAPA_CONV = new Map(CONVERSOES);
  A.chatConversoes = CONVERSOES;
  const converterTexto = (t) => (A.cfg.v.chat && A.cfg.v.chat.conversoes === true ? t.replace(/(^|\s)(\S{2,4})(?=\s|$)/g, (m0, a, w) => (MAPA_CONV.has(w) ? a + MAPA_CONV.get(w) : m0)) : t);
  function carregarNomes() {
    if (A.emojiNomes) return Promise.resolve(A.emojiNomes);
    if (!carregarNomes.p) carregarNomes.p = new Promise((ok) => { const sc = document.createElement('script'); sc.src = 'js/emoji-nomes.js'; sc.onload = () => ok(A.emojiNomes || {}); sc.onerror = () => { carregarNomes.p = null; ok({}); }; document.head.append(sc); });
    return carregarNomes.p;
  }
  function gradeEmojis(o2) {
    const abas = h('div', { class: 'cx-emoji-abas' }), grade = h('div', { class: 'cx-emoji-grade' });
    abas.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || abas.scrollWidth <= abas.clientWidth) return; e.preventDefault(); abas.scrollLeft += e.deltaY; }, { passive: false });
    let tom = TONS.includes(A.cfg.v.tomPele) ? A.cfg.v.tomPele : '', catAtual = '😀';
    const botao = (e0, cat) => { const e = comTom(e0, cat, tom); return h('button', { type: 'button', class: 'cx-emoji' + (o2.marcado && o2.marcado(e) ? ' sel' : ''), title: e, onclick: (ev) => o2.aoEscolher(e, ev.currentTarget) }, e); };
    const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const busca = h('input', { type: 'search', class: 'cx-emoji-busca', placeholder: T('Procurar emoji…', 'Search emoji…'), 'aria-label': T('Procurar emoji', 'Search emoji'), autocomplete: 'off', spellcheck: 'false' });
    let serie = 0;
    const procurar = async () => {
      const q = norm(busca.value), n = ++serie;
      if (!q) { abas.hidden = false; mostrar(catAtual); return; }
      const nomes = await carregarNomes(); if (n !== serie) return;
      const palavras = q.split(/\s+/);
      abas.hidden = true; grade.textContent = '';
      const frag = document.createDocumentFragment(); let achou = 0;
      for (const [cat, lista] of Object.entries(EMOJIS)) for (const e0 of lista) { const t = nomes[e0] || ''; if (palavras.every((p) => t.split(' ').some((w) => w.startsWith(p)))) { frag.append(botao(e0, cat)); if (++achou >= 160) break; } }
      grade.append(achou ? frag : h('div', { class: 'cx-emoji-tit' }, T('Nenhum emoji com esse nome', 'No emoji with that name')));
    };
    busca.addEventListener('input', procurar);
    busca.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = grade.querySelector('.cx-emoji'); if (b) b.click(); } });
    const tomBtn = h('button', { type: 'button', class: 'cx-emoji-aba cx-tom', title: T('Tom de pele', 'Skin tone'), onclick: () => { tom = TONS[(TONS.indexOf(tom) + 1) % TONS.length]; A.cfg.v.tomPele = tom; A.cfg.salvar(); tomBtn.textContent = '✋' + tom; if (busca.value.trim()) procurar(); else mostrar(catAtual); } }, '✋' + tom);
    function mostrar(cat) {
      catAtual = cat; grade.textContent = '';
      abas.querySelectorAll('button[data-cat]').forEach((b) => { b.classList.toggle('sel', b.dataset.cat === cat); if (b.dataset.cat === cat) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
      grade.append(h('div', { class: 'cx-emoji-tit' }, T(...NOMES_CAT[cat])));
      const frag = document.createDocumentFragment();
      for (const e0 of EMOJIS[cat]) frag.append(botao(e0, cat));
      grade.append(frag);
    }
    for (const cat of Object.keys(EMOJIS)) abas.append(h('button', { type: 'button', class: 'cx-emoji-aba', dados: { cat }, title: T(...NOMES_CAT[cat]), onclick: () => mostrar(cat) }, cat));
    abas.append(tomBtn);
    const raiz = h('div', { class: 'cx-emoji-caixa' }, h('div', { class: 'cx-emoji-busca-caixa' }, A.icone('lupa', 15), busca), abas, grade);
    mostrar('😀');
    raiz.focar = () => busca.focus();
    return raiz;
  }
  A.gradeEmojis = gradeEmojis;
  A.chatUI = { criar, comprimir, EMOJIS, quando, exata };
})();
