(function () {
  'use strict';
  // Русский — исходный язык интерфейса. Английский накладывается поверх (DOM-переводчик).
  const D = {
    'Fabric — лёгкий и быстрый': 'Fabric — light and fast',
    'Forge — большая библиотека модов': 'Forge — huge mod library',
    'NeoForge — новое поколение Forge': 'NeoForge — next-gen Forge',
    'Quilt — совместим с модами Fabric': 'Quilt — compatible with Fabric mods',
    'Horizon — неофициальный клиент Minecraft Java, переписанный на Rust: нативный, без Java при игре. Нужна твоя копия игры.': 'Horizon — an unofficial Minecraft Java client rewritten in Rust: native, no Java while playing. You need your own copy of the game.',
    'Java, оперативная память и параметры запуска': 'Java, memory and launch options',
    'Java, память, запуск': 'Java, memory, launch',
    'Аккаунты': 'Accounts', 'АККАУНТЫ': 'ACCOUNTS',
    'Войти через Microsoft': 'Sign in with Microsoft',
    'Всё готово к новому приключению.': 'Everything is ready for a new adventure.',
    'Выбери настроение лаунчера': 'Pick the launcher mood',
    'Выбери установленный профиль с загрузчиком (Fabric, Forge, NeoForge, Quilt), чтобы искать совместимые моды.': 'Pick an installed profile with a loader (Fabric, Forge, NeoForge, Quilt) to search compatible mods.',
    'Выберите версию Minecraft для запуска': 'Choose a Minecraft version to launch',
    'Выберите версию Minecraft ниже, чтобы установить Fabric, Forge, NeoForge или Quilt.': 'Choose a Minecraft version below to install Fabric, Forge, NeoForge or Quilt.',
    'Выбор версий': 'Version picker',
    'Выбрать PNG…': 'Choose PNG…', 'Выбрать сборку': 'Choose build',
    'ГЛАВНАЯ': 'HOME', 'Главная': 'Home',
    'Готовые сборки из Modrinth. Ставятся одной кнопкой и появляются в «Сборках» как отдельная версия.': 'Ready-made packs from Modrinth. One click to install; they show up in “Builds” as a separate version.',
    'Для одиночной игры и серверов без проверки лицензии. Локальный скин можно настроить отдельно.': 'For singleplayer and servers without license checks. A local skin can be set up separately.',
    'Добавить': 'Add', 'Загрузка профиля…': 'Loading profile…', 'Загрузка списка модов…': 'Loading mod list…',
    'Загрузчик модов': 'Mod loader', 'Закрыть': 'Close', 'Играть': 'Play', 'Источник': 'Source',
    'Ищи, устанавливай и управляй модами прямо из лаунчера. Нужные для мода зависимости ставятся сами.': 'Search, install and manage mods right from the launcher. Required dependencies install automatically.',
    'Ищи, устанавливай и управляй модами прямо из Electron. Нужные для мода зависимости ставятся сами.': 'Search, install and manage mods right from Electron. Required dependencies install automatically.',
    'Каталог': 'Catalog', 'Каталог Modrinth': 'Modrinth catalog', 'Классика': 'Classic', 'Консоль игры': 'Game console',
    'Лицензионный вход через Microsoft или офлайн-ник': 'Licensed Microsoft sign-in or an offline nickname',
    'Моды': 'Mods', 'МОДЫ': 'MODS', 'Моды в папке игры': 'Mods in game folder', 'Моды для Horizon': 'Mods for Horizon',
    'Название, автор или описание…': 'Name, author or description…', 'Найти': 'Search',
    'Найти версию: 1.21, 26.3, snapshot…': 'Find a version: 1.21, 26.3, snapshot…', 'Найти моды': 'Find mods',
    'Например: Fabulously Optimized, All the Mods, RLCraft…': 'E.g.: Fabulously Optimized, All the Mods, RLCraft…',
    'Например: Sodium, Iris, map, minimap…': 'E.g.: Sodium, Iris, map, minimap…',
    'Например: Complementary, BSL, Photon…': 'E.g.: Complementary, BSL, Photon…',
    'Например: Faithful, Fresh Animations…': 'E.g.: Faithful, Fresh Animations…',
    'Настройки': 'Settings', 'НАСТРОЙКИ': 'SETTINGS', 'Недавно обновлённые': 'Recently updated',
    'Нет аккаунта': 'No account', 'Ник (3–16 символов)': 'Nickname (3–16 chars)',
    'Обновить все': 'Update all', 'Обновить список': 'Refresh list', 'Обновления': 'Updates',
    'Ожидание выбора сборки': 'Waiting for a build', 'Открой новые миры': 'Discover new worlds',
    'Откройте вкладку «Сборки», чтобы выбрать версию': 'Open the “Builds” tab to pick a version',
    'Открыть папку игры (миры, моды, версии)': 'Open game folder (worlds, mods, versions)',
    'Открыть папку сборки': 'Open build folder', 'Откуда копировать': 'Copy from', 'Отмена': 'Cancel',
    'Офлайн': 'Offline', 'офлайн': 'offline', 'Офлайн-аккаунт': 'Offline account', 'Оформление': 'Appearance',
    'Очистить': 'Clear', 'Папка игры': 'Game folder', 'Перенести файлы из другой сборки': 'Transfer files from another build',
    'По загрузкам': 'By downloads', 'По названию': 'By name', 'По релевантности': 'By relevance',
    'Подготовить': 'Prepare',
    'Поддерживаются сборки на Fabric, Forge, NeoForge и Quilt. Майнкрафт и загрузчик скачаются сами.': 'Fabric, Forge, NeoForge and Quilt packs are supported. Minecraft and the loader download automatically.',
    'Показать ещё': 'Show more',
    'Порядок: 1) «Установить», 2) «Подготовить» (один раз: лаунчер докачает файлы Minecraft и Java, ресурсы соберутся из них, это несколько минут), 3) «Играть». Вход идёт с твоим выбранным аккаунтом. Java-моды (Fabric, Forge, NeoForge) здесь не работают, миры лежат отдельно от обычных сборок. Проект молодой, возможны отличия от оригинала.': 'Order: 1) “Install”, 2) “Prepare” (once: the launcher downloads Minecraft files and Java, then builds resources — takes a few minutes), 3) “Play”. Sign-in uses your selected account. Java mods (Fabric, Forge, NeoForge) do NOT work here, and worlds are stored separately from normal builds. The project is young, so differences from the original are possible.',
    'Применить скин': 'Apply skin', 'Проверяю версию и загрузчик': 'Checking version and loader',
    'Ресурспаки': 'Resource packs', 'Ресурсы': 'Resources', 'Сборка не выбрана': 'No build selected',
    'Сборки': 'Builds', 'СБОРКИ': 'BUILDS', 'Сборки модов': 'Modpacks', 'СБОРКИ МОДОВ': 'MODPACKS',
    'Сбросить скин': 'Reset skin', 'Свернуть': 'Minimize',
    'Сейчас папка модов общая для всех профилей. Используй только совместимые с выбранной версией файлы.': 'The mods folder is currently shared by all profiles. Use only files compatible with the selected version.',
    'Скин': 'Skin', 'Скопировать': 'Copy', 'Сменить сборку': 'Change build', 'Сменить тему': 'Change theme',
    'Сначала выбери сборку с загрузчиком модов.': 'First pick a build with a mod loader.', 'Сначала новые': 'Newest first',
    'Собери свою игру': 'Build your game', 'Совместимость подбирается автоматически': 'Compatibility is picked automatically',
    'Сортировка': 'Sort', 'ТЕКУЩАЯ СБОРКА': 'CURRENT BUILD', 'Твои правила.': 'Your rules.', 'Твой мир.': 'Your world.',
    'Тема': 'Theme',
    'Только то, что Horizon умеет запускать: моды из реестра Horizon, ресурспаки и шейдеры. Java-моды сюда не попадают.': 'Only what Horizon can run: mods from the Horizon registry, resource packs and shaders. Java mods are not included.',
    'Тонкие руки': 'Slim arms', 'Установить': 'Install', 'Установить / обновить': 'Install / update',
    'Установить загрузчик модов': 'Install mod loader', 'Установить поддержку в выбранную сборку': 'Install support into the selected build',
    'Установленные': 'Installed', 'Установлено': 'Installed', 'Установлен': 'Installed',
    'Файл не выбран. Подойдёт скин 64×64.': 'No file selected. A 64×64 skin works.',
    'Файл не выбран. Подойдёт PNG 64×64 (старый формат 64×32 тоже поддерживается).': 'No file selected. A 64×64 PNG works (the old 64×32 format is supported too).',
    'Фильтр по названию…': 'Filter by name…', 'Шейдеры': 'Shaders', 'для твоей игры': 'for your game', 'для стиля': 'for style', 'для картинки': 'for visuals',
    'модов': 'mods', 'на Rust': 'on Rust', 'не подготовлены': 'not prepared', 'не установлен': 'not installed', 'готовы': 'ready',
    'Java': 'Java', 'Установка Java': 'Java installation', 'Оперативная память': 'Memory (RAM)', 'Максимум': 'Maximum',
    'Минимум (при старте)': 'Minimum (at start)', 'Игра': 'Game', 'Обзор': 'Browse', 'Открыть': 'Open',
    'Отдельная папка для каждой сборки': 'Separate folder for each build',
    'У каждой сборки свои моды, шейдеры, ресурспаки, конфиги и миры (папка instances)': 'Each build has its own mods, shaders, resource packs, configs and worlds (instances folder)',
    'Ширина окна': 'Window width', 'Высота окна': 'Window height', 'Параметры запуска': 'Launch options',
    'Дополнительные JVM-аргументы': 'Extra JVM arguments', 'например: -XX:+UseG1GC': 'e.g. -XX:+UseG1GC',
    'Оптимизация G1GC': 'G1GC optimization', 'Полноэкранный режим': 'Fullscreen', 'Запускать игру на весь экран': 'Launch the game fullscreen',
    'Закрывать лаунчер после запуска': 'Close launcher after launch', 'Лаунчер закроется, когда игра начнёт загружаться': 'The launcher closes once the game starts loading',
    'Показывать консоль при запуске': 'Show console on launch', 'Открывать логи игры автоматически': 'Open game logs automatically',
    'Слишком много: игра и система могут тормозить.': 'Too much: the game and system may lag.',
    'Для разных версий Minecraft нужна разная Java: 8 — до 1.16, 17 — для 1.17–1.20.4, 21 — для 1.20.5–1.21.x, 25 — для версий 26.x. Если выбранная Java не подходит, лаунчер подберёт или скачает нужную сам.': 'Different Minecraft versions need different Java: 8 — up to 1.16, 17 — for 1.17–1.20.4, 21 — for 1.20.5–1.21.x, 25 — for 26.x. If the chosen Java doesn’t fit, the launcher picks or downloads the right one.',
    'Java не найдена на компьютере — установите её (например, Temurin) или укажите путь вручную.': 'Java not found on this computer — install it (e.g. Temurin) or set the path manually.',
    'Поиск установленных Java…': 'Looking for installed Java…',
    'Управление аккаунтами': 'Manage accounts', 'Вперёд →': 'Next →', '← Назад': '← Back',
    'Обновить': 'Update', 'Установка…': 'Installing…', 'Обновление…': 'Updating…', 'Скачивание…': 'Downloading…',
    'Microsoft': 'Microsoft', '• выбран': '• selected', 'ОФЛАЙН': 'OFFLINE',
    'Скин': 'Skin', 'Удалить': 'Delete', 'Включить': 'Enable', 'Отключить': 'Disable', 'Выключить': 'Turn off',
    'Пока нет аккаунтов. Войдите через Microsoft или добавьте офлайн-ник.': 'No accounts yet. Sign in with Microsoft or add an offline nickname.',
    'Ничего не найдено': 'Nothing found', 'Ничего не найдено по фильтру.': 'Nothing matches the filter.',
    'Включён': 'Enabled', 'Отключён': 'Disabled', 'Включено': 'Enabled', 'Отключено': 'Disabled', 'Выключен': 'Off',
    'лицензия не указана': 'license not specified', 'подписан': 'signed', 'Без описания': 'No description',
    'Нет описания.': 'No description.', 'Нет описания проекта.': 'No project description.',
    'Автор подписывает файлы, лаунчер проверяет подпись': 'The author signs files; the launcher verifies the signature',
    'Ищу на Modrinth…': 'Searching Modrinth…', 'Modrinth не ответил': 'Modrinth did not respond', 'Повторить': 'Retry',
    'Список не загрузился': 'List failed to load',
    'Нужна сборка с загрузчиком': 'A build with a loader is required', 'Нужна выбранная сборка': 'A selected build is required',
    'Открой «Сборки», установи Fabric, Forge, NeoForge или Quilt и выбери профиль в панели запуска.': 'Open “Builds”, install Fabric, Forge, NeoForge or Quilt and pick the profile in the launch bar.',
    'Открой «Сборки», установи версию Minecraft и выбери её в панели запуска.': 'Open “Builds”, install a Minecraft version and pick it in the launch bar.',
    'Открыть сборки': 'Open builds',
    'Пока ничего не установлено': 'Nothing installed yet', 'Выбери мод, ресурспак или шейдер в каталоге. Они появятся здесь.': 'Pick a mod, resource pack or shader in the catalog. They will appear here.',
    'Попробуй другое название или проверь, есть ли версия для этой сборки.': 'Try another name or check whether a version exists for this build.',
    'Попробуй другое название.': 'Try another name.', 'Попробуй другое название или автора.': 'Try another name or author.', 'Пусто': 'Empty',
    'Версий для этого загрузчика нет.': 'No versions for this loader.', 'Загружаю версии…': 'Loading versions…',
    'Доступные для скачивания': 'Available to download', 'Версии': 'Versions', 'Выбрать версию': 'Choose version',
    'Указать вручную…': 'Set manually…', 'Автоматически (подберётся под версию игры)': 'Automatic (matched to the game version)',
    'Остановить': 'Stop', 'Запуск…': 'Starting…', 'Устанавливаю…': 'Installing…',
    'CustomSkinLoader уже есть в папке mods. Перезапусти игру.': 'CustomSkinLoader is already in the mods folder. Restart the game.',
    'OLED чёрная': 'OLED black', 'установлена': 'installed', 'скачается при первом запуске': 'downloads on first launch',
    'Нет описания': 'No description',
    'Аккаунт Microsoft добавлен': 'Microsoft account added', 'В реестре Horizon пока нет модов, которые он умеет запускать.': 'The Horizon registry has no mods it can run yet.',
    'Версия': 'Version', 'Все': 'All', 'Всё актуально': 'Everything is up to date',
    'Выберите профиль с загрузчиком': 'Pick a profile with a loader', 'Выберите установленную версию Minecraft': 'Pick an installed Minecraft version',
    'Выбрать': 'Select', 'Готово': 'Done', 'Готово — скин обновлён.': 'Done — skin updated.',
    'Для твоей версии Minecraft точной сборки нет — поставлена ближайшая, может не заработать.': 'No exact build for your Minecraft version — the closest one was installed and may not work.',
    'Добавьте аккаунт во вкладке «Аккаунты»': 'Add an account in the “Accounts” tab',
    'Ждём вход…': 'Waiting for sign-in…', 'Загружаю текущий скин…': 'Loading current skin…', 'Закат': 'Sunset',
    'Запуск игры': 'Launching game', 'Игра запускается': 'Game is starting', 'Игра запущена': 'Game is running', 'Зелёная': 'Green',
    'Каталог шейдер-паков Modrinth. На Fabric, Quilt и NeoForge вместе с первым шейдером автоматически ставится Iris (и Sodium).': 'Modrinth shader pack catalog. On Fabric, Quilt and NeoForge, Iris (and Sodium) is installed automatically with your first shader.',
    'Локальный скин сохранён.': 'Local skin saved.',
    'Локальный скин сохранён. Для отображения в игре установи поддержку скинов в этой сборке.': 'Local skin saved. To show it in game, install skin support in this build.',
    'Локальный скин удалён.': 'Local skin removed.', 'Локальный скин уже сохранён.': 'Local skin is already saved.',
    'Мод': 'Mod', 'Мод включён. Перезапусти игру, чтобы он заработал.': 'Mod enabled. Restart the game for it to work.', 'Мод выключен. Перезапусти игру.': 'Mod disabled. Restart the game.',
    'Моды Horizon ставятся в папку игры и сразу включаются. Заработают после перезапуска игры. Включать и выключать их можно во вкладке «Установлено».': 'Horizon mods are placed in the game folder and enabled right away. They work after restarting the game. Toggle them in the “Installed” tab.',
    'Нативный': 'Native',
    'Нативный мод меняет код игры и выполняется с твоими правами. Установка только кладёт файл: он заработает, когда игра будет собрана с ним.': 'A native mod changes the game code and runs with your permissions. Installing only drops the file: it will work once the game is built with it.',
    'Нативных модов в реестре пока нет.': 'No native mods in the registry yet.', 'Не удалось выполнить поиск': 'Search failed',
    'Не удалось изменить состояние': 'Could not change state', 'Не удалось обновить': 'Update failed', 'Не удалось получить версии': 'Could not get versions',
    'Не удалось прочитать папку': 'Could not read folder', 'Не удалось скачать': 'Download failed', 'Не удалось скопировать': 'Copy failed',
    'Не удалось удалить': 'Delete failed', 'Не удалось удалить версию': 'Could not delete version', 'Не удалось установить': 'Install failed',
    'Не удалось установить сборку': 'Could not install the build',
    'Океан': 'Ocean', 'Откройте вкладку «Сборки», чтобы выбрать версию': 'Open the “Builds” tab to pick a version',
    'Открыть папку версии': 'Open version folder',
    'Офлайн-скин сохраняется локально. Чтобы он отображался в игре, нужна поддержка скинов в сборке (клиентский мод CustomSkinLoader). Другие игроки этот локальный скин не увидят, если у них нет совместимой системы скинов.': 'An offline skin is stored locally. To show it in game the build needs skin support (the CustomSkinLoader client mod). Other players won’t see this local skin unless they have a compatible skin system.',
    'Подготовка загрузчика…': 'Preparing loader…', 'Подготовка к запуску': 'Preparing to launch', 'Подготовка…': 'Preparing…',
    'Поиск в установленных…': 'Search installed…', 'Поиск ресурспаков на Modrinth…': 'Search resource packs on Modrinth…', 'Поиск…': 'Searching…',
    'Пока нет JAR-модов. Найди мод в каталоге и нажми «Установить».': 'No JAR mods yet. Find a mod in the catalog and press “Install”.',
    'Пока нет ресурспаков. Найди пак в каталоге и нажми «Установить».': 'No resource packs yet. Find a pack in the catalog and press “Install”.',
    'Пока нет шейдеров. Найди пак в каталоге и нажми «Установить».': 'No shaders yet. Find a pack in the catalog and press “Install”.',
    'Последняя': 'Latest', 'Применяю…': 'Applying…', 'Проверяю…': 'Checking…', 'Релиз': 'Release', 'Релизы': 'Releases', 'Снапшот': 'Snapshot', 'Снапшоты': 'Snapshots', 'Старые': 'Old',
    'Ресурспак': 'Resource pack', 'Ресурспак ставится в папку игры. Чтобы он работал, включи его в игре на экране ресурспаков.': 'The resource pack goes into the game folder. Enable it in game on the resource packs screen.',
    'Ресурспаков для Horizon пока нет в реестре.': 'No resource packs for Horizon in the registry yet.',
    'Сборка не готова': 'Build not ready', 'Светлая': 'Light', 'Скачать': 'Download', 'Скин обновлён. В игре он появится после перезахода.': 'Skin updated. It shows in game after rejoining.',
    'Скин сброшен': 'Skin reset', 'Скин сброшен на стандартный.': 'Skin reset to default.',
    'Скопировать моды, шейдеры и ресурспаки в эту сборку? Копируй только из сборок с той же версией Minecraft и загрузчиком, иначе моды могут не заработать.': 'Copy mods, shaders and resource packs into this build? Copy only from builds with the same Minecraft version and loader, otherwise mods may not work.',
    'Текстуры, звуки и интерфейс. После установки включи пак в игре: Настройки → Ресурспаки.': 'Textures, sounds and interface. After installing, enable the pack in game: Options → Resource Packs.',
    'Текущий скин аккаунта загружен.': 'Current account skin loaded.', 'Тёмная': 'Dark',
    'Удалено из папки игры': 'Removed from game folder', 'Установка Horizon…': 'Installing Horizon…',
    'Установлен · ждёт сборки игры': 'Installed · waiting for game build', 'ждёт сборки игры': 'waiting for game build',
    'Файл пропал из папки игры': 'File is missing from the game folder', 'Файлы скопированы': 'Files copied', 'Фиолетовая': 'Violet', 'Шейдер': 'Shader',
    'Шейдер ставится в папку игры. Выбери его в игре на странице шейдеров.': 'The shader goes into the game folder. Select it in game on the shaders page.',
    'Шейдеров для Horizon пока нет в реестре.': 'No shaders for Horizon in the registry yet.',
    'Эта версия не заявлена для твоей версии Minecraft и может не заработать. Всё равно поставить?': 'This version isn’t declared for your Minecraft version and may not work. Install anyway?',
    'включи его в игре на экране ресурспаков': 'enable it in game on the resource packs screen', 'включён, перезапусти игру': 'enabled, restart the game',
    'выбери его в игре на странице шейдеров': 'select it in game on the shaders page', 'другой загрузчик': 'other loader', 'мод': 'mod', 'не для этой версии': 'not for this version',
    'ресурспак': 'resource pack', 'ресурспаков': 'resource packs', 'только Windows x64': 'Windows x64 only', 'шейдер': 'shader', 'шейдеров': 'shaders',
    'Всего': 'Total', 'Язык': 'Language', 'Язык интерфейса': 'Interface language', 'Интерфейс': 'Interface', 'Панель навигации': 'Navigation panel',
    'Компактная (значки)': 'Compact (icons)', 'С подписями': 'With labels', 'Сверху (вкладки)': 'Top (tabs)',
    'Как выглядит левая панель: значки, значки с подписями или вкладки сверху': 'How the navigation looks: icons, icons with labels, or tabs on top',
    'Выбор языка лаунчера': 'Launcher language', 'Показать подписи': 'Show labels',
    'Пока нет сборок с загрузчиком.': 'No builds with a loader yet.',
    'Всё равно поставить': 'Install anyway', 'Подтверждение': 'Confirmation', 'Подтвердить': 'Confirm',
    'Капсула сверху': 'Top capsule', 'Док снизу': 'Bottom dock', 'Справа': 'Right side',
    'Установка завершена': 'Installation complete', 'Ошибка': 'Error', 'Модпаки': 'Modpacks',
  };
  // Префиксы сообщений об ошибках: «Префикс» + хвост без перевода.
  const PREFIX = [
    ['Не удалось установить загрузчик: ', 'Could not install loader: '], ['Не удалось установить поддержку скинов: ', 'Could not install skin support: '],
    ['Ошибка загрузки: ', 'Load error: '], ['Ошибка каталога: ', 'Catalog error: '], ['Ошибка установки мода: ', 'Mod install error: '],
    ['Ошибка установки сборки: ', 'Pack install error: '], ['Ошибка: ', 'Error: '],
    ['Не удалось установить ', 'Could not install '], ['Не удалось скачать ', 'Could not download '],
  ];
  const R = [
    [/^(.+) • (Microsoft|офлайн)$/, (m) => `${m[1]} • ${m[2] === 'офлайн' ? 'offline' : 'Microsoft'}`],
    [/^(\d+) файл\(ов\) не поддерживают эту версию Minecraft \(⚠ в списке\)$/, (m) => `${m[1]} file(s) don’t support this Minecraft version (⚠ in the list)`],
    [/^(.+) (\S+) установлен для Minecraft (\S+)\. Профиль выбран автоматически\.$/, (m) => `${m[1]} ${m[2]} installed for Minecraft ${m[3]}. Profile selected automatically.`],
    [/^(.+) установлен для Minecraft (\S+)\.$/, (m) => `${m[1]} installed for Minecraft ${m[2]}.`],
    [/^([\d\s\u00a0,.]+) найдено$/, (m) => `${m[1]} found`], [/^(\d+) результатов$/, (m) => `${m[1]} results`],
    [/^(.+) установлен: (.+)$/, (m) => `${m[1]} installed: ${tr(m[2])}`],
    [/^(.+) · включи в игре$/, (m) => `${tr(m[1])} · enable in game`],
    [/^Установка (.+)…$/, (m) => `Installing ${m[1]}…`],
    [/^Выбрано: (.+) для Minecraft (\S+)\. Можно установить другой загрузчик для той же версии\.$/, (m) => `Selected: ${m[1]} for Minecraft ${m[2]}. You can install another loader for the same version.`],
    [/^Вышла новая версия Minecraft (.+)$/, (m) => `New Minecraft version ${m[1]} is out`], [/^Новый снапшот (.+)$/, (m) => `New snapshot ${m[1]}`],
    [/^Готово к запуску • (.+)$/, (m) => `Ready to launch • ${m[1]}`], [/^Доступно обновлений: (\d+)$/, (m) => `Updates available: ${m[1]}`],
    [/^Загрузчик будет установлен для Minecraft (.+)\. Убедитесь, что выбрана нужная версия\.$/, (m) => `The loader will be installed for Minecraft ${m[1]}. Make sure the right version is selected.`],
    [/^Обновить все \((\d+)\)$/, (m) => `Update all (${m[1]})`], [/^Обновить до (.+)$/, (m) => `Update to ${m[1]}`],
    [/^Обновлено: (\d+)\. Перезапусти игру, если она открыта\.$/, (m) => `Updated: ${m[1]}. Restart the game if it is open.`],
    [/^Не скачалось файлов: (\d+) из (\d+)\. Подробности в консоли\.$/, (m) => `Failed to download ${m[1]} of ${m[2]} files. See the console for details.`],
    [/^Отозван реестром: (.+)$/, (m) => `Revoked by registry: ${m[1]}`],
    [/^Папка (.+) общая для всех профилей\. Используй только совместимые с выбранной версией файлы\.$/, (m) => `The ${m[1]} folder is shared by all profiles. Use only files compatible with the selected version.`],
    [/^Поддержка офлайн-скина установлена \((.+), Minecraft (.+)\)\. Перезапусти игру\.$/, (m) => `Offline skin support installed (${m[1]}, Minecraft ${m[2]}). Restart the game.`],
    [/^Показать ещё \((\d+)\)$/, (m) => `Show more (${m[1]})`], [/^Профиль: (.+)$/, (m) => `Profile: ${m[1]}`],
    [/^СБОРКА · (.+)$/, (m) => `BUILD · ${m[1]}`],
    [/^Сборка «(.+)» установлена и выбрана\. Ищи её в «Сборках» среди установленных\.$/, (m) => `Pack “${m[1]}” installed and selected. Find it under “Builds” among installed ones.`],
    [/^Текущая тема: (.+)$/, (m) => `Current theme: ${tr(m[1])}`], [/^Тема «(.+)» применена$/, (m) => `Theme “${tr(m[1])}” applied`],
    [/^У каждой сборки своя папка (.+): сейчас открыта «(.+)»\. Другие сборки не затрагиваются\.$/, (m) => `Each build has its own ${m[1]} folder: currently “${m[2]}”. Other builds are not affected.`],
    [/^Удалить (.+) «(.+)» из папки игры\?$/, (m) => `Delete ${tr(m[1])} “${m[2]}” from the game folder?`],
    [/^Удалить «(.+)» из папки игры Horizon\?$/, (m) => `Delete “${m[1]}” from the Horizon game folder?`],
    [/^Удалить версию (.+) с диска\? Миры и моды не будут затронуты\.$/, (m) => `Delete version ${m[1]} from disk? Worlds and mods are not affected.`],
    [/^Версия (.+) скачана\. Остальное подтянется при первом запуске\.$/, (m) => `Version ${m[1]} downloaded. The rest will be fetched on first launch.`],
    [/^Версия (.+) удалена$/, (m) => `Version ${m[1]} deleted`],
    [/^«(.+)» установлен(.*)\. Перезапусти игру, если она открыта\.$/, (m) => `“${m[1]}” installed${m[2].replace(/ \+ (\d+) (?:зависимост\.|мод\(а\) для работы)/, ' + $1 dependencies')}. Restart the game if it is open.`],
    [/^В реестре Horizon (\d+) проектов \((.+)\)\. Для Minecraft (\S+) подходят (\d+), из них Horizon умеет поставить (\d+)\.$/, (m) => `The Horizon registry has ${m[1]} projects (${m[2]}). ${m[4]} fit Minecraft ${m[3]}, and Horizon can install ${m[5]} of them.`],
    [/^Файл собран для: (.+)$/, (m) => `File built for: ${m[1]}`], [/^Этот (.+) уже установлен$/, (m) => `This ${tr(m[1])} is already installed`],
    [/^Ничего не найдено для Minecraft (.+)$/, (m) => `Nothing found for Minecraft ${m[1]}`],
    [/^v(.+) · (.+)$/, (m) => `v${m[1]} · ${tr(m[2])}`], [/^от (.+)$/, (m) => `by ${m[1]}`],
    [/^Всего в системе: (.+)\. Не выделяйте больше 70–75% — Windows тоже нужна память\.$/, (m) => `Total in system: ${m[1]}. Don’t allocate more than 70–75% — Windows needs memory too.`],
    [/^Вручную: (.+)$/, (m) => `Manual: ${m[1]}`], [/^(.+) • из PATH$/, (m) => `${m[1]} • from PATH`], [/^(\d+) файл\.$/, (m) => `${m[1]} files`],
    [/^(.+) · (\d+) файл\.$/, (m) => `${m[1]} · ${m[2]} files`], [/^Установленные (\d+)$/, (m) => `Installed ${m[1]}`],
    [/^«(.+)» (.*)$/, null],
    [/^Ресурспаки с Modrinth, сделанные для Minecraft (.+)\. Ставятся в папку игры, включи их в игре на экране ресурспаков\. Старые паки могут работать не полностью\.$/, (m) => `Resource packs from Modrinth made for Minecraft ${m[1]}. They go into the game folder; enable them in game on the resource packs screen. Older packs may not work fully.`],
    [/^Фильтр по Minecraft (.+) и (.+)\. Обязательные зависимости скачаются автоматически\. Файлы попадут в папку mods\.$/, (m) => `Filter by Minecraft ${m[1]} and ${m[2]}. Required dependencies download automatically. Files go to the mods folder.`],
    [/^Фильтр по Minecraft (.+)\. Файлы попадут в папку (.+)\.$/, (m) => `Filter by Minecraft ${m[1]}. Files go to the ${m[2]} folder.`],
    [/^Не подходят этой версии игры: (.+)$/, (m) => `Not compatible with this game version: ${m[1]}`],
    [/^Найти (.+)$/, (m) => `Find ${m[1]}`],
  ].filter((r) => r[1]);
  function tr(s) {
    if (!s) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const core = s.trim().replace(/\s+/g, ' ');
    if (!core || !/[А-Яа-яЁё]|ГБ/.test(core)) return s;
    let out = D[core];
    if (out === undefined) {
      for (const [re, fn] of R) { const m = re.exec(core); if (m) { out = fn(m); break; } }
    }
    if (out === undefined) for (const [ru, en] of PREFIX) if (core.startsWith(ru)) { out = en + core.slice(ru.length); break; }
    if (out === undefined) out = core;
    out = out.replace(/(\d)\s*ГБ/g, '$1 GB');
    return lead + out + trail;
  }

  let lang = 'ru';
  const textOrig = new WeakMap(), attrOrig = new WeakMap();
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  let busy = false;
  function doText(n) {
    const rec = textOrig.get(n);
    if (lang === 'ru') { if (rec && n.nodeValue === rec.out) { busy = true; n.nodeValue = rec.src; busy = false; } textOrig.delete(n); return; }
    if (rec && n.nodeValue === rec.out) return;
    const out = tr(n.nodeValue);
    if (out !== n.nodeValue) { textOrig.set(n, { src: n.nodeValue, out }); busy = true; n.nodeValue = out; busy = false; }
  }
  function doEl(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      const rec = (attrOrig.get(el) || {})[a], cur = el.getAttribute(a);
      if (lang === 'ru') { if (rec && cur === rec.out) el.setAttribute(a, rec.src); continue; }
      if (rec && cur === rec.out) continue;
      const out = tr(cur);
      if (out !== cur) { const o = attrOrig.get(el) || {}; o[a] = { src: cur, out }; attrOrig.set(el, o); el.setAttribute(a, out); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) { const p = n.parentNode; if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue; doText(n); } else doEl(n); }
  }
  const mo = new MutationObserver((list) => {
    if (busy) return;
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doEl(m.target);
    }
  });
  const nativeConfirm = window.confirm.bind(window), nativeAlert = window.alert.bind(window);
  window.confirm = (m) => nativeConfirm(lang === 'en' ? tr(String(m)) : m);
  window.alert = (m) => nativeAlert(lang === 'en' ? tr(String(m)) : m);

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ru';
    document.documentElement.lang = lang;
    try { localStorage.setItem('lang', lang); } catch {}
    walk(document.body);
    document.title = 'Electron';
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  function start() {
    try { lang = localStorage.getItem('lang') || (/^ru/i.test(navigator.language) ? 'ru' : 'en'); } catch {}
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    setLang(lang);
  }
  window.I18N = { tr, setLang, get lang() { return lang; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
