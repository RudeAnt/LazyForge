import pandas as pd
import numpy as np
import random

print("Генерируем ЭКСТРЕМАЛЬНЫЙ датасет на 50 000 строк...")
n = 50000

# 10 классов (например, для автопилота)
classes = ['Машина', 'Пешеход', 'Светофор', 'Знак', 'Автобус', 'Грузовик', 'Велосипед', 'Мотоцикл', 'Самокат', 'Енот']

# Дикий дисбаланс: Машин много, Енотов почти нет
weights = [0.4, 0.3, 0.1, 0.05, 0.05, 0.04, 0.03, 0.02, 0.009, 0.001]
true_classes = random.choices(classes, weights=weights, k=n)

data = []
for i in range(n):
    t_class = true_classes[i]
    t_idx = classes.index(t_class)
    scenario = random.random()

    if scenario < 0.5:
        # 50% данных: Модель уверена и права
        probs = np.random.uniform(0.01, 0.05, 10)
        probs[t_idx] = np.random.uniform(0.8, 0.99)
    elif scenario < 0.75:
        # 25% данных: Полный хаос. Максимальная энтропия. Модель запуталась в 10 классах.
        probs = np.full(10, 0.1) + np.random.uniform(-0.02, 0.02, 10)
    else:
        # 25% данных: Грубая ошибка разметки. Уверена на 90% совершенно в другом классе.
        probs = np.random.uniform(0.01, 0.05, 10)
        wrong_idx = (t_idx + random.randint(1, 9)) % 10
        probs[wrong_idx] = np.random.uniform(0.8, 0.99)

    # Нормализуем, чтобы сумма вероятностей была ровно 1.0
    probs = probs / probs.sum()

    # Собираем строку
    row = {
        'id_объекта': f'extreme_{i:05d}.jpg', 
        'истинный_класс': t_class, 
        'разметчик': random.choice(['AutoLabel', 'Expert_Bob', 'Intern_Vasya'])
    }
    
    for c_idx, c_name in enumerate(classes):
        row[f'prob_{c_name}'] = round(probs[c_idx], 4)

    data.append(row)

# Делаем DataFrame
df = pd.DataFrame(data)

print("Добавляем 'яд' в данные (грязь и дубликаты)...")
# Добавляем 500 полных дубликатов в конец
duplicates = df.sample(500)
df = pd.concat([df, duplicates], ignore_index=True)
# Обходим защиту Pandas, меняя тип колонок на object перед инъекцией яда
df['prob_Машина'] = df['prob_Машина'].astype(object)
df['prob_Енот'] = df['prob_Енот'].astype(object)

# Портим данные! Симулируем сбой при выгрузке из нейросети
df.loc[10:15, 'prob_Машина'] = "ERROR"
df.loc[100:105, 'prob_Енот'] = "0.04 55" # Тот самый пробел
df.loc[500:505, 'prob_Пешеход'] = np.nan # Пустые значения

# Сохраняем монстра
df.to_csv('dataset_extreme.csv', index=False, encoding='utf-8')
print("Готово! Создан файл 'dataset_extreme.csv' (около 5-10 мегабайт).")
print("Закидывай его в свой Streamlit-дашборд!")
