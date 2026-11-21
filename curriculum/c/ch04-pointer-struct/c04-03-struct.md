数组要求所有元素同类型。但现实里的「一条学生记录」包含学号（int）、姓名（字符串）、成绩（double），类型不同。这时候需要结构体。

## 定义与使用

```c
struct Student {
    int    id;
    char   name[32];
    double score;
};
```

这是**定义了一个类型**，不是变量。它不占内存。

用的时候：

```c
struct Student s;                 // 声明一个变量
s.id = 1001;
strcpy(s.name, "宁雪");           // 字符数组不能用 = 赋值，要用 strcpy
s.score = 88.5;

printf("%d %s %.1f\n", s.id, s.name, s.score);
```

**注意 `s.name = "宁雪"` 是错的**——数组名是地址，不能被赋值。字符串赋值必须用 `strcpy`（需要 `#include <string.h>`）。

## 用 typedef 省掉 struct 关键字

```c
typedef struct {
    int    id;
    char   name[32];
    double score;
} Student;

Student s;                        // 不用再写 struct
```

**实践中的标准写法**：定义时直接用 `typedef`，之后的类型名就是 `Student`。省字，也更像其他语言的写法。

注意 `typedef struct { ... } Student;` 里 `Student` 是类型名，而 `struct Student { ... }` 里 `Student` 是结构体标签。两者可以不同名，但保持一致最好。

## 初始化

```c
Student s1 = {1001, "宁雪", 88.5};              // 按顺序
Student s2 = {.score = 92.0, .id = 1002};       // C99 指定成员，其余自动为 0
```

第二种写法（designated initializer）更好：**顺序无关，且只写想设的字段**。以后结构体加字段时，这种初始化不会因为顺序变化而出错。

## 结构体数组：存一批记录

```c
Student class_a[3] = {
    {1001, "宁雪", 88.5},
    {1002, "李雷", 92.0},
    {1003, "韩梅", 76.5},
};

for (int i = 0; i < 3; i++) {
    printf("%d %-8s %.1f\n", class_a[i].id, class_a[i].name, class_a[i].score);
}
```

结构体数组就是「一条记录一个格子」，是处理表格型数据最基本的方式。

## 结构体指针：用 -> 代替 (*p).

```c
Student s = {1001, "宁雪", 88.5};
Student *p = &s;

printf("%d\n", (*p).id);      // 可以，但括号不能少
printf("%d\n", p->id);        // 等价，更常用
```

`p->id` 就是 `(*p).id` 的简写。**必须加括号**，因为 `.` 的优先级高于 `*`，`*p.id` 会被解释成 `*(p.id)`，而 `p` 不是结构体，编译报错。

**实践：只要是指针，就用 `->`。** 这是 C 代码里最常见的语法之一。

## 结构体作为函数参数：传值还是传地址

```c
void print_by_value(Student s) { ... }        // 复制整个结构体
void print_by_addr(const Student *s) { ... }  // 只传地址
```

**传值会复制整个结构体**。如果结构体很大（比如含 1000 个元素的数组），每次调用都要复制几 KB，很慢。

**规则：结构体参数一律传地址，并用 `const` 表明不修改。**

```c
void print_student(const Student *s) {
    printf("%d %s %.1f\n", s->id, s->name, s->score);
}

print_student(&s);
```

要修改时去掉 `const`：

```c
void add_bonus(Student *s, double bonus) {
    s->score += bonus;
}
```

## 结构体可以嵌套

```c
typedef struct {
    int year, month, day;
} Date;

typedef struct {
    int    id;
    char   name[32];
    Date   birthday;
    double score;
} Student;

Student s = {.id = 1001, .birthday = {2006, 3, 15}, .score = 88.5};
printf("%d-%02d-%02d\n", s.birthday.year, s.birthday.month, s.birthday.day);
```

嵌套的成员用 `.` 一层层访问。如果是指针，就用 `->` 进去，再 `.`：

```c
Student *p = &s;
p->birthday.year      // 正确
```

## 结构体的大小可能比你想的大

```c
struct A { char c; int i; };
printf("%zu\n", sizeof(struct A));    // 可能是 8，不是 5
```

原因是**内存对齐**：编译器为了让 `int` 落在 4 的倍数地址上，会在 `char` 后面填 3 字节空隙。

这带来一个实用建议：**把大的成员放前面，小的放后面**，能减少填充：

```c
struct Bad  { char a; int b; char c; };   // 12 字节
struct Good { int b; char a; char c; };   // 8 字节
```

初学阶段不用刻意优化，但要知道 `sizeof` 不等于成员大小之和。

## 一个完整例子：按成绩排序

```c
#include <stdio.h>
#include <string.h>

typedef struct {
    int    id;
    char   name[32];
    double score;
} Student;

void sort_by_score(Student a[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j].score < a[j + 1].score) {      // 降序
                Student t = a[j];
                a[j] = a[j + 1];
                a[j + 1] = t;                       // 结构体可以整体赋值
            }
        }
    }
}

int main(void) {
    Student a[] = {
        {1001, "宁雪", 88.5},
        {1002, "李雷", 92.0},
        {1003, "韩梅", 76.5},
    };
    int n = sizeof(a) / sizeof(a[0]);

    sort_by_score(a, n);
    for (int i = 0; i < n; i++)
        printf("%d %-8s %.1f\n", a[i].id, a[i].name, a[i].score);

    return 0;
}
```

**注意 `Student t = a[j];`：结构体可以整体赋值**，不用逐个成员拷贝。这是结构体比数组方便的地方（数组不能整体赋值）。

## 自查

1. 字符串成员用的是 `strcpy` 还是 `=`？
2. 结构体指针访问成员用的是 `->` 还是 `.`？
3. 大结构体传参是传地址还是传值？
4. 只读参数加 `const` 了吗？
