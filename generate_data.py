import pandas as pd
import numpy as np
import random

# Фиксируем seed, чтобы генерация была одинаковой при каждом запуске
np.random.seed(42)
random.seed(42)

def generate_fake_dataset(n=1000):
    data = []
    classes = ['Собака', 'Кошка', 'Мышь']

    for i in range(n):
        # 1. Имитируем дефицит классов: Мышей будет всего около 5%
        true_class = random.choices(classes, weights=[0.5, 0.45, 0.05])[0]

        scenario = random.random()

        if scenario < 0.6:
            # Ситуация 1 (60% данных): Идеальный случай. Модель уверена и права.
            class_idx = classes.index(true_class)
            probs = np.random.uniform(0.01, 0.1, 3) # Низкие вероятности для всех
            probs[class_idx] = np.random.uniform(0.8, 0.99) # Высокая для правильного
            probs = probs / probs.sum() # Нормализуем, чтоб сумма была ровно 1.0

        elif scenario < 0.8:
            # Ситуация 2 (20% данных): Сложный случай / Зона неопределенности. 
            # Вероятности размазаны, модель не понимает, что на фото.
            probs = np.array([0.33, 0.34, 0.33]) + np.random.uniform(-0.05, 0.05, 3)
            probs = probs / probs.sum()

        else:
            # Ситуация 3 (20% данных): Потенциальная ошибка разметки.
            # Человек сказал одно, а модель на 90% уверена в другом.
            wrong_class_idx = (classes.index(true_class) + 1) % 3
            probs = np.random.uniform(0.01, 0.1, 3)
            probs[wrong_class_idx] = np.random.uniform(0.8, 0.99)
            probs = probs / probs.sum()

        # Собираем строку данных с метаданными [cite: 156]
        data.append({
            'id_объекта': f'img_{i:04d}.jpg',
            'истинный_класс': true_class,
            'prob_Собака': round(probs[0], 4),
            'prob_Кошка': round(probs[1], 4),
            'prob_Мышь': round(probs[2], 4),
            'разрешение': random.choice(['1920x1080', '800x600', '640x480']),
            'разметчик': random.choice(['Expert_Anna', 'Expert_Bob', 'Intern_Vasya'])
        })

    # Превращаем список в удобную таблицу (DataFrame)
    df = pd.DataFrame(data)

    # Добавляем 15 полных дубликатов в конец датасета, чтобы потом их героически найти
    duplicates = df.sample(15)
    df = pd.concat([df, duplicates], ignore_index=True)

    return df

# Запускаем функцию
print("Начинаю ковать данные...")
dataset = generate_fake_dataset(1000)

# Сохраняем в CSV файл
dataset.to_csv('dataset_forge.csv', index=False, encoding='utf-8')
print("Готово! Файл 'dataset_forge.csv' сохранен в папке проекта.")
