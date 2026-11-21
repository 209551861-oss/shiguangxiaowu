数组传进函数后会发生一件奇怪的事：它不再是你以为的那个数组。

搞不清这一点，`sizeof` 会给出诡异的数字，函数里改数组又「莫名」影响了外面。这一节把机制讲透，然后用它实现查找和排序。

## 数组作为参数会退化成指针

```c
void show(int a[5]) {
    printf("%zu\n", sizeof(a));    // 8（64 位指针大小），不是 20
}
```

`int a[5]` 里的 `5` **没有意义**。编译器会把它当作 `int *a` 处理。

```c
void show(int a[5]);     // 等价于
void show(int a[]);      // 等价于
void show(int *a);       // 都是指针
```

所以函数**必须额外接收长度**：

```c
void show(int a[], int n) {
    for (int i = 0; i < n; i++) printf("%d ", a[i]);
}
```

这是 C 的硬规则，没有例外。

## 但能改到原数组

指针指向的是原数组的内存，所以函数里通过下标写，改的是原件：

```c
void double_all(int a[], int n) {
    for (int i = 0; i < n; i++) a[i] *= 2;    // 直接改原数组
}

int main(void) {
    int arr[3] = {1, 2, 3};
    double_all(arr, 3);
    // arr 现在是 2 4 6
}
```

这看起来和「按值传递」矛盾，其实一致：**传递的是指针的副本，副本指向同一块内存**。改指针指向的内容，原件跟着变；改指针本身，原件不受影响。

```c
void reassign(int a[]) {
    a = NULL;          // 只改了副本，调用者的数组不受影响
}
```

这个区别在后面学链表时会反复用到。

## 顺序查找

最简单直接：挨个比。

```c
/* 找到返回下标，没找到返回 -1 */
int find(int a[], int n, int target) {
    for (int i = 0; i < n; i++) {
        if (a[i] == target) return i;
    }
    return -1;
}
```

**返回值用 `-1` 表示「没找到」是 C 的惯例**，因为合法下标不会是负数。

调用方必须检查返回值：

```c
int idx = find(arr, n, 42);
if (idx >= 0) {
    printf("在下标 %d\n", idx);
} else {
    printf("没找到\n");
}
```

## 冒泡排序：理解排序的入口

思路：相邻两个比，大的往后换，一轮下来最大的到了末尾。

```c
void bubble_sort(int a[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int swapped = 0;
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                int t = a[j];
                a[j] = a[j + 1];
                a[j + 1] = t;
                swapped = 1;
            }
        }
        if (!swapped) break;      // 一轮没交换，说明已经有序
    }
}
```

三个细节值得说：

1. **内层写 `n - 1 - i`**：每轮结束后末尾已经有 `i+1` 个元素排好，不用再比
2. **`swapped` 优化**：已经有序时提前退出，最好情况 O(n)
3. **交换用临时变量**：这是 C 里交换的标准写法，三行

对比次数约 n²/2，1000 个元素要 50 万次比较。实际项目不会用它，但**它是理解「排序是什么」最短的路径**。

## 二分查找：有序数组的加速器

有序数组里查东西，可以每次都砍掉一半。

```c
/* 前提：a 已按升序排好；找到返回下标，否则返回 -1 */
int binary_search(int a[], int n, int target) {
    int low = 0, high = n - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) low = mid + 1;
        else                 high = mid - 1;
    }
    return -1;
}
```

三个容易错的点：

**1. 循环条件是 `low <= high`**，不是 `<`。因为区间是闭区间 `[low, high]`，只剩一个元素时（`low == high`）还要检查。

**2. `mid` 的写法**：`low + (high - low) / 2` 而不是 `(low + high) / 2`。后者在 `low` 和 `high` 都很大时会整数溢出。这个细节来自真实的 bug（Java 的二分查找曾因此出错十余年）。

**3. 更新是 `mid + 1` / `mid - 1`**，不是 `mid`。否则区间不缩小，死循环。

对比次数约 log₂n，100 万个元素只需 20 次。这就是「排好序」的价值。

## 把两个函数串起来

```c
#include <stdio.h>

void bubble_sort(int a[], int n);
int binary_search(int a[], int n, int target);

int main(void) {
    int a[] = {42, 7, 19, 88, 3, 56, 21};
    int n = sizeof(a) / sizeof(a[0]);

    bubble_sort(a, n);
    for (int i = 0; i < n; i++) printf("%d ", a[i]);
    printf("\n");

    int target = 19;
    int idx = binary_search(a, n, target);
    if (idx >= 0) printf("%d 在下标 %d\n", target, idx);
    else          printf("%d 不在数组里\n", target);

    return 0;
}
```

注意 `sizeof(a) / sizeof(a[0])` 在 `main` 里有效（`a` 还是数组），传到函数里就失效了——这正是本节开头讲的那件事。

## 什么时候用哪个

| 场景 | 选择 | 原因 |
|---|---|---|
| 数据乱序、只查一两次 | 顺序查找 | 排序的成本比重查还高 |
| 数据有序、反复查 | 二分查找 | O(log n) |
| 数据量小（< 50） | 顺序查找 | 简单，且常数小 |
| 需要边插边查 | 先考虑别的结构（哈希/树） | 数组插入要搬元素 |

**不要为了用二分而先排序再只查一次**——排序 O(n log n)，比顺序查找 O(n) 还慢。

## 自查

1. 函数收数组时同时收长度了吗？
2. 函数里用 `sizeof(a)` 算长度了吗（这是错的）？
3. 二分查找的 `low <= high` 和 `mid ± 1` 写对了吗？
4. 查找函数的返回值检查了吗？
