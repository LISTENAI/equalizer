cmake_minimum_required(VERSION 3.20)
cmake_policy(SET CMP0091 NEW)
project(lsaudio_native VERSION 0.1.0 LANGUAGES C)

set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
set(CMAKE_BUILD_WITH_INSTALL_RPATH ON)
if(APPLE)
  set(CMAKE_INSTALL_RPATH "@loader_path")
  set(CMAKE_INSTALL_NAME_DIR "@rpath")
elseif(UNIX)
  set(CMAKE_INSTALL_RPATH "$ORIGIN")
endif()

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)
include(CTest)

# All native modules share one build tree; never emit into dlls/ or src/.
foreach(kind RUNTIME LIBRARY ARCHIVE)
  set(CMAKE_${kind}_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
  foreach(config DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set(CMAKE_${kind}_OUTPUT_DIRECTORY_${config} "${CMAKE_BINARY_DIR}/lib")
  endforeach()
endforeach()

add_subdirectory(modules/eqdrc)
add_subdirectory(modules/eqdraw)
add_subdirectory(modules/soundeffect)
