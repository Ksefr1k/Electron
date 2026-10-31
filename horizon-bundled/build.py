#!/usr/bin/env python3
"""Собирает встроенные моды Horizon (.hmod) в эту же папку. Только стандартная библиотека.

    python build.py

.hmod — zip с horizon-mod.toml, assets/ и data/ (docs/mods.md в репозитории Horizon). Кода внутри нет.
Тексты и модели свои; текстуры нарисованы здесь же, чтобы не зависеть от чужих файлов.
"""
import json, os, struct, zlib, zipfile, hashlib, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def png(pixels):
    """pixels: 16 строк по 16 кортежей (r,g,b,a) -> байты PNG."""
    raw = b''.join(b'\x00' + b''.join(bytes(p) for p in row) for row in pixels)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 16, 16, 8, 6, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def noise(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 255) / 255.0


def lamp_texture(base, seed):
    """Лампа: светлая сердцевина, рамка потемнее, лёгкий шум."""
    rows = []
    for y in range(16):
        row = []
        for x in range(16):
            edge = min(x, y, 15 - x, 15 - y)
            c = shade(base, 0.62) if edge == 0 else shade(base, 0.82) if edge == 1 else base
            if edge >= 2:
                d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5 / 7.0
                c = mix((255, 255, 255), base, min(1.0, d * 0.9))
            c = shade(c, 0.94 + noise(x, y, seed) * 0.12)
            row.append((*c, 255))
        rows.append(row)
    return png(rows)


def gem_block_texture(base, seed):
    """Блок самоцвета: грани-ромбы разной яркости."""
    rows = []
    for y in range(16):
        row = []
        for x in range(16):
            edge = min(x, y, 15 - x, 15 - y)
            facet = (abs(x - 7.5) + abs(y - 7.5))
            k = 1.18 - (int(facet) % 4) * 0.12
            c = shade(base, k)
            if edge == 0:
                c = shade(base, 0.55)
            c = shade(c, 0.95 + noise(x, y, seed) * 0.1)
            row.append((*c, 255))
        rows.append(row)
    return png(rows)


def blank():
    return [[(0, 0, 0, 0)] * 16 for _ in range(16)]


def gem_item_texture(base):
    px = blank()
    outline = shade(base, 0.45)
    cells = {}
    # ромб 5..10 по обеим осям
    for y in range(2, 14):
        w = 6 - abs(y - 7.5) * 0.9
        for x in range(16):
            if abs(x - 7.5) <= w:
                cells[(x, y)] = True
    for (x, y) in cells:
        inner = all(((x + dx, y + dy) in cells) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        light = 1.35 if (x + y) < 15 and x < 8 else 0.9 if x > 8 else 1.1
        px[y][x] = (*(shade(base, light) if inner else outline), 255)
    # блик
    for (x, y) in ((5, 5), (6, 4), (5, 4)):
        if (x, y) in cells:
            px[y][x] = (255, 255, 255, 255)
    return png(px)


STICK = (110, 78, 42)


def sword_texture(blade):
    px = blank()
    dark = shade(blade, 0.55)
    for i in range(10):
        x, y = 4 + i, 11 - i
        px[y][x] = (*blade, 255)
        if x + 1 < 16:
            px[y][x + 1] = (*dark, 255)
        if y - 1 >= 0:
            px[y - 1][x] = (*shade(blade, 1.25), 255)
    # гарда и рукоять
    for (x, y) in ((3, 10), (4, 11), (5, 12), (2, 12), (3, 13), (4, 12)):
        px[y][x] = (150, 120, 40, 255)
    for (x, y) in ((2, 13), (1, 14), (1, 15), (2, 14)):
        px[y][x] = (*STICK, 255)
    return png(px)


def pickaxe_texture(head):
    px = blank()
    dark = shade(head, 0.55)
    # рукоять по диагонали
    for i in range(11):
        x, y = 2 + i, 13 - i
        px[y][x] = (*STICK, 255)
    # дуга головы
    arc = [(3, 3), (4, 2), (5, 1), (6, 1), (7, 1), (8, 1), (9, 2), (10, 3), (11, 4), (12, 5), (13, 7), (14, 9),
           (4, 3), (5, 2), (6, 2), (7, 2), (8, 2), (9, 3), (10, 4), (11, 5), (12, 6), (13, 8)]
    for (x, y) in arc:
        px[y][x] = (*head, 255)
    for (x, y) in ((3, 3), (4, 2), (13, 8), (14, 9), (5, 1), (12, 5)):
        px[y][x] = (*dark, 255)
    return png(px)


def j(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'


def toml(manifest):
    out = []
    for k, v in manifest.items():
        if isinstance(v, list):
            out.append(f'{k} = [' + ', '.join(json.dumps(x, ensure_ascii=False) for x in v) + ']')
        else:
            out.append(f'{k} = {json.dumps(v, ensure_ascii=False)}')
    return '\n'.join(out) + '\n'


def write_hmod(mod_id, manifest, files):
    path = os.path.join(HERE, f'{mod_id}-{manifest["version"]}.hmod')
    for name in files:
        assert name.startswith(('assets/', 'data/')), name
        assert all(c.islower() or c.isdigit() or c in '_.-/' for c in name), name
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        info = zipfile.ZipInfo('horizon-mod.toml', (2026, 10, 31, 0, 0, 0))
        z.writestr(info, toml(manifest))
        for name in sorted(files):
            data = files[name]
            if isinstance(data, str):
                data = data.encode('utf-8')
            z.writestr(zipfile.ZipInfo(name, (2026, 10, 31, 0, 0, 0)), data, zipfile.ZIP_DEFLATED)
    return path


def block_loot(mod_id, name):
    # формат шаблона cargo-horizon-mod (проверен харнессом Horizon)
    return j({
        'type': 'minecraft:block',
        'pools': [{
            'condition': {'type': 'minecraft:survives_explosion'},
            'entries': [{'type': 'minecraft:item', 'name': f'{mod_id}:{name}'}],
            'rolls': 1,
        }],
        'random_sequence': f'{mod_id}:blocks/{name}',
    })


def cube_block(files, mod_id, name, texture_png, decl, tex_dir='block'):
    files[f'data/{mod_id}/horizon/block/{name}.json'] = j(decl)
    files[f'assets/{mod_id}/blockstates/{name}.json'] = j({'variants': {'': {'model': f'{mod_id}:block/{name}'}}})
    files[f'assets/{mod_id}/models/block/{name}.json'] = j({'parent': 'minecraft:block/cube_all', 'textures': {'all': f'{mod_id}:block/{name}'}})
    files[f'assets/{mod_id}/items/{name}.json'] = j({'model': {'type': 'minecraft:model', 'model': f'{mod_id}:block/{name}'}})
    files[f'assets/{mod_id}/textures/block/{name}.png'] = texture_png
    files[f'data/{mod_id}/loot_table/blocks/{name}.json'] = block_loot(mod_id, name)


def flat_item(files, mod_id, name, texture_png, handheld=False):
    files[f'assets/{mod_id}/models/item/{name}.json'] = j({
        'parent': 'minecraft:item/handheld' if handheld else 'minecraft:item/generated',
        'textures': {'layer0': f'{mod_id}:item/{name}'},
    })
    files[f'assets/{mod_id}/items/{name}.json'] = j({'model': {'type': 'minecraft:model', 'model': f'{mod_id}:item/{name}'}})
    files[f'assets/{mod_id}/textures/item/{name}.png'] = texture_png


# --------------------------------------------------------------------------- Lux Lamps
def lux_lamps():
    mod_id = 'lux_lamps'
    manifest = {
        'id': mod_id, 'name': 'Lux Lamps', 'version': '1.0.0',
        'description': 'Four bright full-cube lamps in different colours. No code, just blocks.',
        'authors': ['MyLauncher'], 'api': '0.2', 'side': 'both', 'capabilities': ['registries'],
    }
    lamps = [
        ('warm_lamp', 'Warm Lamp', 'Тёплая лампа', (255, 196, 92), 'minecraft:yellow_dye'),
        ('cool_lamp', 'Cool Lamp', 'Холодная лампа', (120, 220, 255), 'minecraft:cyan_dye'),
        ('violet_lamp', 'Violet Lamp', 'Фиолетовая лампа', (186, 130, 255), 'minecraft:purple_dye'),
        ('rose_lamp', 'Rose Lamp', 'Розовая лампа', (255, 130, 170), 'minecraft:pink_dye'),
    ]
    files, en, ru = {}, {}, {}
    for i, (name, en_name, ru_name, color, dye) in enumerate(lamps):
        cube_block(files, mod_id, name, lamp_texture(color, i + 1), {
            'template': 'minecraft:sea_lantern',
            'properties': {'hardness': 0.3, 'light': 15, 'sounds': 'minecraft:glass'},
        })
        files[f'data/{mod_id}/recipe/{name}.json'] = j({
            'type': 'minecraft:crafting_shaped', 'category': 'building',
            'pattern': ['GGG', 'GDG', 'GGG'],
            'key': {'G': 'minecraft:glowstone_dust', 'D': dye},
            'result': {'id': f'{mod_id}:{name}', 'count': 2},
        })
        en[f'block.{mod_id}.{name}'] = en_name
        ru[f'block.{mod_id}.{name}'] = ru_name
    files[f'assets/{mod_id}/lang/en_us.json'] = j(en)
    files[f'assets/{mod_id}/lang/ru_ru.json'] = j(ru)
    return write_hmod(mod_id, manifest, files)


# --------------------------------------------------------------------------- Gems
def gems():
    mod_id = 'gems'
    manifest = {
        'id': mod_id, 'name': 'Ruby & Sapphire', 'version': '1.0.0',
        'description': 'Ruby and sapphire gems, gem blocks, swords and pickaxes. Gems are crafted from a diamond and a redstone or lapis block.',
        'authors': ['MyLauncher'], 'api': '0.2', 'side': 'both', 'capabilities': ['registries'],
    }
    files, en, ru = {}, {}, {}
    gem_defs = [
        ('ruby', 'Ruby', 'Рубин', (224, 36, 64), 'minecraft:redstone_block', 'Ruby Block', 'Рубиновый блок', 'Ruby Sword', 'Рубиновый меч', 'Ruby Pickaxe', 'Рубиновая кирка', 7.0, 1400, 1),
        ('sapphire', 'Sapphire', 'Сапфир', (48, 110, 235), 'minecraft:lapis_block', 'Sapphire Block', 'Сапфировый блок', 'Sapphire Sword', 'Сапфировый меч', 'Sapphire Pickaxe', 'Сапфировая кирка', 6.5, 1700, 2),
    ]
    pickaxe_tag = []
    for (g, en_g, ru_g, color, source, en_b, ru_b, en_s, ru_s, en_p, ru_p, dmg, durability, seed) in gem_defs:
        # самоцвет
        files[f'data/{mod_id}/horizon/item/{g}.json'] = j({'template': 'minecraft:diamond'})
        flat_item(files, mod_id, g, gem_item_texture(color))
        files[f'data/c/tags/item/gems/{g}.json'] = j({'values': [f'{mod_id}:{g}']})
        # блок
        cube_block(files, mod_id, f'{g}_block', gem_block_texture(color, seed), {
            'template': 'minecraft:emerald_block',
            'properties': {'hardness': 5.0, 'explosion_resistance': 6.0, 'requires_tool': True},
        })
        pickaxe_tag.append(f'{mod_id}:{g}_block')
        # меч и кирка
        files[f'data/{mod_id}/horizon/item/{g}_sword.json'] = j({
            'template': 'minecraft:iron_sword',
            'components': {
                'minecraft:max_damage': durability,
                'minecraft:attribute_modifiers': [{
                    'type': 'minecraft:attack_damage', 'id': 'minecraft:base_attack_damage',
                    'amount': dmg, 'operation': 'add_value', 'slot': 'mainhand',
                }, {
                    'type': 'minecraft:attack_speed', 'id': 'minecraft:base_attack_speed',
                    'amount': -2.4, 'operation': 'add_value', 'slot': 'mainhand',
                }],
            },
        })
        flat_item(files, mod_id, f'{g}_sword', sword_texture(color), handheld=True)
        files[f'data/{mod_id}/horizon/item/{g}_pickaxe.json'] = j({
            'template': 'minecraft:iron_pickaxe',
            'components': {'minecraft:max_damage': durability},
        })
        flat_item(files, mod_id, f'{g}_pickaxe', pickaxe_texture(color), handheld=True)
        # рецепты
        files[f'data/{mod_id}/recipe/{g}.json'] = j({
            'type': 'minecraft:crafting_shapeless', 'category': 'misc',
            'ingredients': ['minecraft:diamond', source],
            'result': {'id': f'{mod_id}:{g}', 'count': 2},
        })
        files[f'data/{mod_id}/recipe/{g}_block.json'] = j({
            'type': 'minecraft:crafting_shaped', 'category': 'building',
            'pattern': ['###', '###', '###'], 'key': {'#': f'{mod_id}:{g}'},
            'result': {'id': f'{mod_id}:{g}_block'},
        })
        files[f'data/{mod_id}/recipe/{g}_from_block.json'] = j({
            'type': 'minecraft:crafting_shapeless', 'category': 'misc',
            'ingredients': [f'{mod_id}:{g}_block'],
            'result': {'id': f'{mod_id}:{g}', 'count': 9},
        })
        files[f'data/{mod_id}/recipe/{g}_sword.json'] = j({
            'type': 'minecraft:crafting_shaped', 'category': 'equipment',
            'pattern': ['#', '#', 'S'], 'key': {'#': f'{mod_id}:{g}', 'S': 'minecraft:stick'},
            'result': {'id': f'{mod_id}:{g}_sword'},
        })
        files[f'data/{mod_id}/recipe/{g}_pickaxe.json'] = j({
            'type': 'minecraft:crafting_shaped', 'category': 'equipment',
            'pattern': ['###', ' S ', ' S '], 'key': {'#': f'{mod_id}:{g}', 'S': 'minecraft:stick'},
            'result': {'id': f'{mod_id}:{g}_pickaxe'},
        })
        en.update({f'item.{mod_id}.{g}': en_g, f'block.{mod_id}.{g}_block': en_b,
                   f'item.{mod_id}.{g}_sword': en_s, f'item.{mod_id}.{g}_pickaxe': en_p})
        ru.update({f'item.{mod_id}.{g}': ru_g, f'block.{mod_id}.{g}_block': ru_b,
                   f'item.{mod_id}.{g}_sword': ru_s, f'item.{mod_id}.{g}_pickaxe': ru_p})
    files['data/minecraft/tags/block/mineable/pickaxe.json'] = j({'values': pickaxe_tag})
    files[f'assets/{mod_id}/lang/en_us.json'] = j(en)
    files[f'assets/{mod_id}/lang/ru_ru.json'] = j(ru)
    return write_hmod(mod_id, manifest, files)


if __name__ == '__main__':
    for old in os.listdir(HERE):
        if old.endswith('.hmod'):
            os.remove(os.path.join(HERE, old))
    built = [lux_lamps(), gems()]
    index = []
    for p in built:
        data = open(p, 'rb').read()
        index.append({'file': os.path.basename(p), 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)})
        print('built', os.path.basename(p), len(data), 'bytes')
    with open(os.path.join(HERE, 'bundled.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2)
