Electron
A custom Minecraft Java launcher with themes, Modrinth mods, auto-installed Java and mod loaders.

Свой лаунчер Minecraft Java: темы, моды из Modrinth, автоматическая установка Java и загрузчиков.






⬇️ Download / Скачать  ·  🌐 Website / Сайт
English  |  Русский

🇬🇧 English
✨ Features
	
🎮 Game versions	Releases, snapshots, beta/alpha and installed loader profiles
🧩 Mod loaders	Fabric, Forge, NeoForge and Quilt, installed in one click
📦 Modrinth	Search mods, resource packs and shaders, install modpacks (.mrpack)
🔗 Dependencies	Required dependencies are installed automatically and recursively
👤 Accounts	Microsoft login (session refresh) or an offline nickname
🖼️ Skins	Upload skins for Microsoft accounts, local PNG skins for offline accounts
☕ Java	Picks and downloads the right Java for each Minecraft version
🦀 Horizon	Install and launch the experimental Rust client of Minecraft
🎨 7 themes	Green, light, dark, OLED black, purple, ocean, sunset
🌍 Languages	Russian and English interface

⬇️ Installation
1.	Open the Releases page.
2.	Download Electron-Setup-<version>.exe.
3.	Run the installer and launch Electron.
Requirements: Windows 10/11 (x64) and an internet connection for the first launch of Minecraft, loaders and mods. Java is installed automatically.
🔍 Details
Mod loaders and modpacks
·	Installs stable Fabric/Quilt, the recommended Forge, or the latest stable NeoForge for the selected Minecraft version.
·	NeoForge is installed by the official installer on first launch (needs Java, takes a few minutes).
·	Quilt uses Fabric mods (Quilted Fabric API is installed instead of Fabric API).
·	Modrinth modpacks (.mrpack) work on all four loaders and use the loader version specified in the pack.
·	The first launch of each build downloads game files and libraries.
Mods, shaders and resource packs
·	Search Modrinth filtered by Minecraft version and loader; install compatible JAR files; enable, disable or delete installed mods.
·	Dependencies are downloaded automatically. Mods you added by hand are recognized by hash and are not duplicated.
·	Shaders and resource packs have their own tabs and go to shaderpacks and resourcepacks. They also work on vanilla Minecraft.
·	For shaders on Fabric, Iris (with Sodium) is installed together with your first shader pack.
·	If there is no exact version for your build, the closest one is installed with a warning.
·	Version picker: the Versions button lists all versions of a project. Compatible ones are marked ✓, others ⚠ (installed only after confirmation).
·	Mod updates: checked by hash via Modrinth when you open the page. Update one mod or all at once; the enabled/disabled state is kept.
·	CurseForge is not supported.
Accounts and skins
·	Microsoft accounts keep the session refreshed. Offline nicknames are 3-16 characters (A-Z, 0-9, _).
·	For an offline account, choose a Fabric/Forge profile and press Install support into selected build in the skin window. The launcher downloads a compatible CustomSkinLoader from Modrinth and puts your skin into a local folder.
·	A local skin does not become your official Microsoft skin and is not visible to other players without a compatible skin system.
Java
·	Automatically chosen by Minecraft version.
·	If the required Java is missing, the launcher downloads an Eclipse Temurin JDK through the Adoptium API, checks the archive size and SHA-256, retries failed downloads up to 3 times, and verifies Java before installing.
·	x64 Java for 64-bit Windows, x86 for 32-bit.
Horizon (Rust client) 🦀
·	Installs and runs the unofficial Horizon client (Windows x64 only), no Java during gameplay.
·	The Horizon tab has a catalog of mods, resource packs and shaders from the Horizon registry. The launcher checks the checksum, the author's signature and the mod's capabilities. Java mods (Fabric, Forge, NeoForge) do not work in Horizon and are not shown.
·	Nightly: since 28.10.2026 Horizon publishes Nightly builds only (release nightly, marked pre-release). The launcher installs it as nightly-<date>-<commit>; if there is no Nightly, it takes the latest regular release.
·	Built-in mods (the Built-in tab, work offline): Lux Lamps (4 colored lamps) and Ruby & Sapphire (gems, blocks, swords and pickaxes). Add your own .hmod… installs any content mod from disk. Sources and builder: horizon-bundled/build.py.
·	Before each launch the launcher rewrites horizon-mods.txt so enabled mods are never lost. Native mods (.hnmod) only work in a game build that includes them.
Separate folder for each build
Enabled by default (Settings → Game). Mods, shaders, resource packs, configs, worlds and offline skins live in <game folder>\instances\<build>. Only versions, libraries and Minecraft assets are shared, so disk space is not duplicated. Files from the old shared folder can be moved with the Copy button on the mods page.
📁 Data folders
What	Where
Game, versions, mods, worlds	%APPDATA%\.mylauncher (default)
Settings, log, downloaded Java	Electron userData folder
Offline skins	userData/skins, then copied into the selected game folder

🛠️ Build from source
You need Node.js LTS.
npm install
npm start          # run the launcher
npm run build      # build the Windows installer

The installer appears in the dist/ folder.
Releasing: build the installer, then create a new release and attach the .exe. The website download button always picks the latest one.
⚠️ Disclaimer
Electron is not affiliated with Mojang Studios or Microsoft. Minecraft is a trademark of Mojang Studios.

🇷🇺 Русский
✨ Возможности
	
🎮 Версии игры	Релизы, снапшоты, beta/alpha и установленные профили загрузчиков
🧩 Загрузчики	Fabric, Forge, NeoForge и Quilt, установка в один клик
📦 Modrinth	Поиск модов, ресурспаков и шейдеров, установка модпаков (.mrpack)
🔗 Зависимости	Обязательные зависимости ставятся сами и рекурсивно
👤 Аккаунты	Вход через Microsoft (с обновлением сессии) или офлайн-ник
🖼️ Скины	Загрузка скинов для Microsoft, локальный PNG для офлайн-аккаунта
☕ Java	Сама подбирает и скачивает нужную Java под версию игры
🦀 Horizon	Установка и запуск экспериментального клиента Minecraft на Rust
🎨 7 тем	Зелёная, светлая, тёмная, OLED-чёрная, фиолетовая, океан, закат
🌍 Языки	Интерфейс на русском и английском

⬇️ Установка
1.	Открой страницу Releases.
2.	Скачай файл Electron-Setup-<версия>.exe.
3.	Запусти установщик, затем открой Electron.
Требования: Windows 10/11 (x64). Для первого запуска Minecraft, загрузчиков и модов нужен интернет. Java устанавливается автоматически.
🔍 Подробности
Загрузчики и модпаки
·	Ставит стабильный Fabric/Quilt, рекомендованный Forge или последнюю стабильную версию NeoForge для выбранной версии Minecraft.
·	NeoForge ставится официальным установщиком при первом запуске (нужна Java, занимает несколько минут).
·	Quilt использует моды Fabric (вместо Fabric API ставится Quilted Fabric API).
·	Модпаки Modrinth (.mrpack) работают на всех четырёх загрузчиках и используют версию загрузчика, указанную в сборке.
·	Первый запуск каждой сборки докачивает игровые файлы и библиотеки.
Моды, шейдеры и ресурспаки
·	Поиск на Modrinth с фильтром по версии Minecraft и загрузчику, установка совместимых JAR-файлов, включение, отключение и удаление установленных модов.
·	Зависимости скачиваются автоматически. Моды, добавленные вручную, опознаются по хешу и не дублируются.
·	Шейдеры и ресурспаки вынесены в отдельные вкладки и попадают в shaderpacks и resourcepacks. Работают и на чистом Minecraft.
·	Для шейдеров на Fabric вместе с первым паком ставится Iris (с Sodium).
·	Если точной версии под твою сборку нет, ставится ближайшая с предупреждением.
·	Выбор версии: кнопка «Версии» показывает все версии проекта. Подходящие помечены ✓, остальные ⚠ (ставятся только после подтверждения).
·	Обновления модов: проверка по хешам через Modrinth при открытии страницы. Можно обновить один мод или все сразу, состояние «включён/отключён» сохраняется.
·	CurseForge не подключён.
Аккаунты и скины
·	Microsoft-аккаунты поддерживают обновление сессии. Офлайн-ник: 3-16 символов (A-Z, 0-9, _).
·	Чтобы локальный скин показывался в игре, выбери профиль Fabric/Forge и нажми в окне скина «Установить поддержку в выбранную сборку». Лаунчер скачает совместимый CustomSkinLoader с Modrinth и положит скин в локальную папку.
·	Локальный скин не станет официальным скином Microsoft и не будет виден другим игрокам без совместимой системы скинов.
Java
·	Подбирается автоматически под версию Minecraft.
·	Если нужной Java нет, лаунчер скачивает JDK Eclipse Temurin через API Adoptium, проверяет размер и SHA-256 архива, повторяет неудачную загрузку до 3 раз и проверяет Java перед установкой.
·	Для 64-битной Windows скачивается x64, для 32-битной x86.
Horizon (клиент на Rust) 🦀
·	Установка и запуск неофициального клиента Horizon (только Windows x64), без Java во время игры.
·	Во вкладке «Horizon» есть каталог модов, ресурспаков и шейдеров из реестра Horizon. Лаунчер проверяет контрольную сумму, подпись автора и возможности мода. Java-моды (Fabric, Forge, NeoForge) в Horizon не работают и здесь не показываются.
·	Nightly: с 28.10.2026 Horizon выпускает только Nightly (релиз nightly, помеченный как pre-release). Лаунчер ставит его как nightly-<дата>-<коммит>; если Nightly нет, берёт последний обычный релиз.
·	Встроенные моды (вкладка «Встроенные», работают без интернета): Lux Lamps (4 цветные лампы) и Ruby & Sapphire (самоцветы, блоки, мечи и кирки). Кнопка «Добавить свой .hmod…» ставит любой контентный мод с диска. Исходники и сборщик: horizon-bundled/build.py.
·	Перед каждым запуском лаунчер заново записывает horizon-mods.txt, чтобы включённые моды не терялись. Нативные моды (.hnmod) работают только в игре, собранной с ними.
Отдельная папка для каждой сборки
Включена по умолчанию («Настройки → Игра»). Моды, шейдеры, ресурспаки, конфиги, миры и офлайн-скины лежат в <папка игры>\instances\<сборка>. Общими остаются только версии, библиотеки и ресурсы Minecraft, поэтому место не дублируется. Файлы из старой общей папки можно перенести кнопкой «Скопировать» на странице модов.
📁 Папки данных
Что	Где
Игра, версии, моды, миры	%APPDATA%\.mylauncher (по умолчанию)
Настройки, лог, скачанная Java	папка userData Electron
Офлайн-скины	userData/skins, затем копируются в папку выбранной игры

🛠️ Сборка из исходников
Нужен Node.js LTS.
npm install
npm start          # запуск лаунчера
npm run build      # сборка установщика для Windows

Установщик появится в папке dist/.
Выпуск версии: собери установщик, затем создай новый релиз и прикрепи .exe. Кнопка скачивания на сайте всегда берёт последний.
⚠️ Отказ от ответственности
Electron не связан с Mojang Studios или Microsoft. Minecraft — торговая марка Mojang Studios.
