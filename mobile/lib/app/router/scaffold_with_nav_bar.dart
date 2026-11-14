import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:roshan_study/core/constants/app_constants.dart';

class ScaffoldWithNavBar extends StatelessWidget {
  const ScaffoldWithNavBar({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  static const List<String> _titles = [
    AppConstants.appName,
    'Learn',
    'Practice',
    'Board Exams',
    'Progress',
  ];

  static const List<NavigationDestination> _destinations = [
    NavigationDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: 'Home',
    ),
    NavigationDestination(
      icon: Icon(Icons.menu_book_outlined),
      selectedIcon: Icon(Icons.menu_book),
      label: 'Learn',
    ),
    NavigationDestination(
      icon: Icon(Icons.edit_note_outlined),
      selectedIcon: Icon(Icons.edit_note),
      label: 'Practice',
    ),
    NavigationDestination(
      icon: Icon(Icons.assignment_outlined),
      selectedIcon: Icon(Icons.assignment),
      label: 'Exams',
    ),
    NavigationDestination(
      icon: Icon(Icons.insights_outlined),
      selectedIcon: Icon(Icons.insights),
      label: 'Progress',
    ),
  ];

  static const List<NavigationRailDestination> _railDestinations = [
    NavigationRailDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: Text('Home'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.menu_book_outlined),
      selectedIcon: Icon(Icons.menu_book),
      label: Text('Learn'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.edit_note_outlined),
      selectedIcon: Icon(Icons.edit_note),
      label: Text('Practice'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.assignment_outlined),
      selectedIcon: Icon(Icons.assignment),
      label: Text('Exams'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.insights_outlined),
      selectedIcon: Icon(Icons.insights),
      label: Text('Progress'),
    ),
  ];

  void _onSelectBranch(int index, int currentIndex) {
    navigationShell.goBranch(
      index,
      initialLocation: index == currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = navigationShell.currentIndex;
    final isTablet = MediaQuery.sizeOf(context).width >= 720;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _titles[currentIndex],
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: 'Display & Preferences',
            icon: const Icon(Icons.tune_outlined),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: isTablet
            ? Row(
                children: [
                  NavigationRail(
                    selectedIndex: currentIndex,
                    labelType: NavigationRailLabelType.all,
                    onDestinationSelected: (index) =>
                        _onSelectBranch(index, currentIndex),
                    destinations: _railDestinations,
                  ),
                  const VerticalDivider(width: 1),
                  Expanded(child: navigationShell),
                ],
              )
            : navigationShell,
      ),
      bottomNavigationBar: isTablet
          ? null
          : NavigationBar(
              selectedIndex: currentIndex,
              onDestinationSelected: (index) =>
                  _onSelectBranch(index, currentIndex),
              destinations: _destinations,
            ),
    );
  }
}
